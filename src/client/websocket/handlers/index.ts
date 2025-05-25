import { GatewayDispatchEvents } from 'discord-api-types/gateway';
import type Client from '@/client/Client';

export const SUPPORTED_ACTIONS = {
 [GatewayDispatchEvents.MessageCreate]: true,
} as const;
export default async () => {
 const entries = await Promise.all(
  Object.keys(SUPPORTED_ACTIONS).map(async (event) => {
   const fileName = event.toUpperCase();
   const action = await import(`@/client/websocket/handlers/${fileName}`);
   return [event, action.default] as const;
  })
 );
 return Object.fromEntries(entries) as Record<keyof typeof SUPPORTED_ACTIONS, (client: Client, packet: unknown, shardId?: number) => void>;
};
