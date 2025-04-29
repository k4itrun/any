export default {
 run: async (_client, message) => {
  return console.log(message.content);
 },
} satisfies Command;
