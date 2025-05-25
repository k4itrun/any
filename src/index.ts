import path from 'node:path';
import url from 'node:url';
import { GatewayIntentBits } from 'discord-api-types/v10';
import Client from '@/client/Client';
import loadCommands from '@/loaders/commands';

const cwd = path.dirname(url.fileURLToPath(import.meta.url));
console.log(`[Worker]: Working directory set to: ${cwd}\n`);
process.chdir(cwd);

const client = new Client({
 intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

global.commands = new Map<string, Command>();
await loadCommands(global.commands);

client.on('messageCreate', async (message) => {
 if (!message.content || message.author.bot) return;
 const mention = `<@${Buffer.from(`${process.env.CLIENT_TOKEN}`.split('.')[0], 'base64').toString('utf8')}>`;
 if (!message.content.startsWith(mention) && !message.content.startsWith(process.env.CLIENT_PREFIX)) return;
 const content = message.content.replace(mention, '').replace(process.env.CLIENT_PREFIX, '').trim();
 const [name, ...args] = content.split(/\s+/);
 const command = global.commands.get(name);
 if (command && typeof command.run === 'function') {
  try {
   await command.run(client, message, args);
   console.log(`[Command]: Executed ${name} by ${message.author.username}`);
  } catch (error) {
   console.error(`[Command Error]: ${name}`, error);
  }
 }
});

client.on('ready', (client) => {
 console.log(`[Client]: Logged in as ${client.user.username} (${client.user.id})`);
});

client.login();
