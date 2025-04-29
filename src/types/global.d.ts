/* eslint-disable no-var, no-use-before-define */
import type Client from "@/client/Client";

declare global {
 var commands: Map<string, Command>;
 interface ActionInstance {
  new (client: Client): object;
 }

 type ActionProperty<T extends ActionInstance> = T extends { name: `${infer Name}Action` } ? Name : never;

 interface WebSocketManagerOptions {
  intents?: number[];
  token?: string | null;
 }

 interface BaseClientOptions extends WebSocketManagerOptions {
  ws?: WebSocketManagerOptions;
 }

 interface Command {
  name?: string;
  cooldown?: number;
  run: (client: Client, message: Record<string, unknown>, args: unknown[]) => Promise<void>;
 }
}

export {};
