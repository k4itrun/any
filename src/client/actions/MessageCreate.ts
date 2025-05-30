<<<<<<< HEAD
import logger from '@billoneta/utils/logger';
=======
>>>>>>> d536d389dafe983a3846684eb7efb772c7e0bcbf
import Action from '@/client/actions/Action';

class MessageCreateAction extends Action {
 handle(data: unknown): void {
  if (!data) throw new Error('Message data is required');
  try {
   this.client.emit('messageCreate', data);
  } catch (error) {
<<<<<<< HEAD
   logger.error('Error emitting messageCreate event:', error);
=======
   console.error('Error emitting messageCreate event:', error);
>>>>>>> d536d389dafe983a3846684eb7efb772c7e0bcbf
   this.client.emit('error', error instanceof Error ? error.message : String(error));
  }
 }
}
export default MessageCreateAction;
