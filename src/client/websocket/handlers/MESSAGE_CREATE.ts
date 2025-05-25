import type Client from '@/client/Client';

export default (client: Client, packet: unknown, _shardId?: number): void => {
 if (!client.actions.MessageCreate) {
  client.emit('debug', '[MESSAGE_CREATE] MessageCreate action not registered');
  return;
 }
 client.actions.MessageCreate.handle(packet);
};
