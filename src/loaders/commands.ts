import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import logger from '@billoneta/utils/logger';

const globalFilePath = (path: string): string => url.pathToFileURL(path)?.href || path;

export default async (commands: Map<string, Command>) => {
 try {
  const cmds = await fs.readdir(`${process.cwd()}/commands`);
  for (const cmd of cmds) {
   try {
    const { default: _command } = (await import(globalFilePath(`${process.cwd()}/commands/${cmd}`))) as { default: Command };

    if (!_command.name) _command.name = path.parse(cmd).name;
    commands.set(_command.name, _command);
   } catch (err) {
    logger.error(`[Command Error]: ${cmd}`, err);
   }
  }
  for (const cmd of [...commands.keys()]) {
   logger.log(`[Command Loaded]: ${cmd}`);
  }
 } catch (err) {
  logger.error(`[Loader Error]:`, err);
 }
};
