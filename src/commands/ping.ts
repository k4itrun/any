import logger from '@billoneta/utils/logger';

export default {
 run: async (_client, message, args) => {
  return logger.log(message.content, args);
 },
} satisfies Command;
