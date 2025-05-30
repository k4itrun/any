import BaseClient from '@/client/BaseClient';
import ActionsManager from '@/client/actions/ActionsManager';
import WebSocketManager from '@/client/websocket/WebSocketManager';
import handler, { SUPPORTED_ACTIONS } from '@/client/websocket/handlers';

class Client extends BaseClient {
 private token: string | null = null;
 public readonly intents: number[];

 public readonly actions: ActionsManager;
 public readonly ws: WebSocketManager;

 constructor(options: BaseClientOptions = {}) {
  super(options);
  this._validateOptions(options);
  this.intents = options.intents || [];
  this.actions = new ActionsManager(this);
  this.ws = new WebSocketManager({
   ...options.ws,
   intents: this.intents,
   token: null,
  });
  this.token = options.ws?.token ?? process.env.CLIENT_TOKEN ?? null;
  this._attachEvents();
 }

 public async login(token?: string): Promise<string> {
  const authToken = this._validateToken(token || this.token);
  this.token = this._normalizeToken(authToken);
  this.ws.setToken(this.token);
  try {
   await this.ws.connect();
   return this.token;
  } catch (_error) {
   this.destroy();
   throw new Error(`Login failed: Invalid token`);
  }
 }

 public destroy(): void {
  super.destroy();
  this.ws.destroy();
  this.token = null;
 }

 private _attachEvents(): void {
  this.ws.on('ready', (client) => this.emit('ready', client));
  this.ws.on('resumed', () => this.emit('resumed'));
  this.ws.on('debug', (info: string, shardId?: number) => {
   this.emit('debug', `[WS => ${shardId ? `Shard ${shardId}` : 'Manager'}]: ${info}`);
  });
  this.ws.on('dispatch', async (payload, shardId?: number) => {
   const event = payload.t;
   if (!event || !(event in SUPPORTED_ACTIONS)) return;
   const handlers = await handler();
   const action = handlers[event as keyof typeof SUPPORTED_ACTIONS];
   action(this, payload.d, shardId);
  });
 }

 private _validateToken(token?: string | null): string {
  if (!token) throw new Error('Token is required');
  if (!/^(mfa\.)?[\w-]{24,}\.[\w-]{6,}\.[\w-]{27}/i.test(token)) {
   throw new Error('Invalid token format');
  }
  return token;
 }

 private _normalizeToken(token: string): string {
  return token.replace(/^(Bot|Bearer)\s*/i, '');
 }

 private _validateOptions(options: BaseClientOptions): void {
  if (!options.intents?.length && !options.ws?.intents?.length) {
   throw new Error('At least one intent must be provided.');
  }
 }
}

export default Client;
