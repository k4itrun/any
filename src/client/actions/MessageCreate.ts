import Action from "@/client/actions/Action";
class MessageCreateAction extends Action {
 handle(data: unknown): void {
  if (!data) throw new Error("Message data is required");
  try {
   this.client.emit("messageCreate", data);
  } catch (error) {
   console.error("Error emitting messageCreate event:", error);
   this.client.emit("error", error instanceof Error ? error.message : String(error));
  }
 }
}
export default MessageCreateAction;
