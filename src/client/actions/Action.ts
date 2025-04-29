import type Client from "@/client/Client";
class GenericAction {
 readonly client: Client;
 constructor(client: Client) {
  this.client = client;
 }
}
export default GenericAction;
