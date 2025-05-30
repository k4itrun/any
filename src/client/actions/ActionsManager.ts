import type Client from '@/client/Client';
import MessageCreateAction from '@/client/actions/MessageCreate';

const INJECTED_CHANNEL = Symbol('any.actions.injectedChannel');

class ActionsManager {
 readonly client: Client;
 readonly injectedChannel: symbol = INJECTED_CHANNEL;

 public MessageCreate?: MessageCreateAction;
 constructor(client: Client) {
  this.client = client;
  this.register(MessageCreateAction);
 }

 register<T extends ActionInstance>(Action: T): void {
  if (typeof Action !== 'function' || !('prototype' in Action)) throw new Error(`Provided Action must be a class constructor, received: ${typeof Action}`);
  const toRegister = Action.name.replace(/Action$/, '') as ActionProperty<T>;
  (this as unknown as Record<string, InstanceType<T>>)[toRegister] = new Action(this.client) as InstanceType<T>;
 }
}

export default ActionsManager;
