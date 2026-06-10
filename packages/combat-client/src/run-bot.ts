import { pathToFileURL } from 'node:url';
import { runBotCombat } from './bot/run-bot-combat.js';

export async function main(): Promise<void> {
  const combatWsUrl = process.argv[2];
  const token = process.argv[3];
  if (!combatWsUrl || !token) {
    throw new Error('usage: run-bot <combatWsUrl> <token>');
  }
  await runBotCombat(combatWsUrl, token);
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
