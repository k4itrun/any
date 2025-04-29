import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { GatewayDispatchEvents, GatewayOpcodes } from "discord-api-types/v10";
import type { GatewayReceivePayload, GatewaySendPayload, GatewayHelloData } from "discord-api-types/v10";

const DEFAULT_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;
const IDENTIFY_PROPERTIES = {
 os: process.platform,
 browser: "discord.js",
 device: "discord.js",
};

class WebSocketManager extends EventEmitter {
 private _token: string | null = null;
 private readonly _intents: number;

 private ws: WebSocket | null = null;
 private heartbeatInterval: NodeJS.Timeout | undefined;

 private lastSequence: number | null = null;
 private sessionId: string | null = null;
 private acknowledged = false;
 private reconnectAttempts = 0;

 private connectionPromise: Promise<void> | undefined;
 private connectionResolve?: () => void;
 private connectionReject?: (reason?: unknown) => void;

 constructor(options: WebSocketManagerOptions) {
  super();
  this._token = options.token ?? null;
  this._intents = this._calculateIntents(options.intents || []);
 }

 private _calculateIntents(intents: number[]): number {
  let result = 0;
  for (const intent of intents) {
   result |= intent;
  }
  return result;
 }

 public async connect(): Promise<void> {
  if (this.connectionPromise) return this.connectionPromise;

  this.connectionPromise = new Promise((resolve, reject) => {
   this.connectionResolve = resolve;
   this.connectionReject = reject;
  });

  try {
   await this._internalConnect();
   await this.connectionPromise;
   this.reconnectAttempts = 0;
  } catch (error) {
   this.connectionReject?.(error);
   throw error;
  } finally {
   this.connectionPromise = undefined;
  }
 }

 public async identify(): Promise<void> {
  if (!this._token) throw new Error("Token not set");
  try {
   await this._send({
    op: GatewayOpcodes.Identify,
    d: {
     token: this._token,
     intents: this._intents,
     properties: IDENTIFY_PROPERTIES,
    },
   });
  } catch (error) {
   this._debug(`Identify failed: ${error}`);
   throw new Error("Invalid token or connection error");
  }
 }

 public async resume(): Promise<void> {
  if (!this._token || !this.sessionId || !this.lastSequence) {
   this._debug("Cannot resume - missing token, sessionId or sequence");
   return this.identify();
  }

  this._debug(`Attempting to resume session ${this.sessionId} at sequence ${this.lastSequence}`);

  await this._send({
   op: GatewayOpcodes.Resume,
   d: {
    token: this._token,
    session_id: this.sessionId,
    seq: this.lastSequence,
   },
  });
 }

 public setToken(token: string): void {
  if (this._token) throw new Error("Token has already been set");
  this._token = token;
 }

 public async destroy(): Promise<void> {
  this._cleanupHeartbeat();
  this.removeAllListeners();

  if (this.ws) {
   this.ws.close();
   this.ws = null;
  }
 }

 private async _internalConnect(): Promise<void> {
  this.ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
  this._setupEventListeners();
 }

 private _setupEventListeners(): void {
  if (!this.ws) return;

  this.ws.onopen = () => {
   this._debug("WebSocket connection opened");
   this.acknowledged = false;
  };

  this.ws.onmessage = async (event) => {
   try {
    await this._handleMessage(event.data);
   } catch (error) {
    this.emit("error", error instanceof Error ? error.message : String(error));
   }
  };

  this.ws.onclose = (event) => {
   this._handleClose(event);
  };

  this.ws.onerror = (error) => {
   this.emit("error", error instanceof Error ? error.message : String(error));
  };
 }

 private async _handleMessage(data: WebSocket.Data): Promise<void> {
  const payload = await this._unpackMessage(data);
  if (!payload) return;

  switch (payload.op) {
   case GatewayOpcodes.Hello:
    await this._handleHello(payload.d);
    break;

   case GatewayOpcodes.HeartbeatAck:
    this.acknowledged = true;
    this._debug("Received heartbeat ACK");
    break;

   case GatewayOpcodes.Dispatch:
    await this._handleDispatch(payload);
    break;

   case GatewayOpcodes.Reconnect:
    await this._handleReconnect();
    break;

   case GatewayOpcodes.InvalidSession:
    await this._handleInvalidSession(payload.d);
    break;
  }
 }

 private async _handleHello(data: GatewayHelloData): Promise<void> {
  this._startHeartbeat(data.heartbeat_interval);
  try {
   if (this.sessionId) await this.resume();
   else await this.identify();
  } catch (error) {
   this.connectionReject?.(error);
   await this.destroy();
  }
 }

 private async _handleDispatch(payload: GatewayReceivePayload): Promise<void> {
  switch (payload.t) {
   case GatewayDispatchEvents.Ready:
    this.sessionId = payload.d.session_id;
    this.connectionResolve?.();
    this.emit("ready", payload.d);
    this._debug(`Logged in as ${payload.d.user.username} (${payload.d.user.id})`);
    this._debug(`\x1b[32m${JSON.stringify(payload.d.user)}\x1b[0m`);
    break;

   case GatewayDispatchEvents.Resumed:
    this._debug("Session resumed successfully");
    this.connectionResolve?.();
    this.emit("resumed");
    break;
  }

  this.emit("dispatch", payload);
  this._debug(`Event ${payload.t?.toLocaleLowerCase()} received`);
 }

 private async _handleReconnect(): Promise<void> {
  this._debug("Received reconnect request from Discord");
  await this.destroy();
  await this.connect();
 }

 private async _handleInvalidSession(canResume: boolean): Promise<void> {
  this._debug(`Invalid session, can resume: ${canResume}`);

  if (canResume) {
   setTimeout(() => this.resume(), 5000);
  } else {
   this.sessionId = null;
   this.lastSequence = null;
   setTimeout(() => this.identify(), 5000);
  }
 }

 private _handleClose(event: WebSocket.CloseEvent): void {
  this._debug(`Connection closed with code ${event.code}: ${event.reason}`);
  this._cleanupHeartbeat();

  if (event.code === 4004) {
   this.connectionReject?.(new Error("Invalid token provided"));
   return;
  }

  if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
   this._scheduleReconnect();
  } else {
   this.connectionReject?.(new Error("Max reconnect attempts reached"));
  }
 }

 private _scheduleReconnect(): void {
  this.reconnectAttempts++;
  const delay = DEFAULT_RECONNECT_DELAY * this.reconnectAttempts;
  this._debug(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  setTimeout(() => this.connect(), delay);
 }

 private _cleanupHeartbeat(): void {
  if (this.heartbeatInterval) {
   clearInterval(this.heartbeatInterval);
   this.heartbeatInterval = undefined;
  }
 }

 private _startHeartbeat(interval: number): void {
  this._cleanupHeartbeat();

  const initialDelay = Math.floor(Math.random() * interval);
  setTimeout(() => this.heartbeat(true), initialDelay);

  this.heartbeatInterval = setInterval(() => {
   this.heartbeat(true);
  }, interval);
 }

 public async heartbeat(requested = false): Promise<void> {
  if (!requested && !this.acknowledged) {
   this._debug("Heartbeat not acknowledged, terminating connection");
   return this.destroy();
  }

  this.acknowledged = false;
  await this._send({
   op: GatewayOpcodes.Heartbeat,
   d: this.lastSequence,
  });
 }

 private async _unpackMessage(data: WebSocket.Data): Promise<GatewayReceivePayload | null> {
  try {
   const text = data instanceof ArrayBuffer ? Buffer.from(data).toString() : data.toString();
   const payload = JSON.parse(text) as GatewayReceivePayload;
   if (payload.s) this.lastSequence = payload.s;
   return payload;
  } catch (error) {
   this._debug(`Failed to unpack message: ${error instanceof Error ? error.message : String(error)}`);
   return null;
  }
 }

 private async _send(payload: GatewaySendPayload): Promise<void> {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
   throw new Error("WebSocket is not connected");
  }

  return new Promise((resolve, reject) => {
   this.ws!.send(JSON.stringify(payload), (error) => {
    if (error) {
     this._debug(`Failed to send payload: ${error.message}`);
     reject(error);
    } else {
     resolve();
    }
   });
  });
 }

 public _debug(message: string): void {
  this.emit("debug", message, 0);
 }
}

export default WebSocketManager;
