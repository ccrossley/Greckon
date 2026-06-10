import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function spawnCombatBot(combatWsUrl: string, token: string): void {
  const entry = join(rootDir, 'packages/combat-client/dist/run-bot.js');
  const child = spawn(process.execPath, [entry, combatWsUrl, token], {
    cwd: rootDir,
    env: process.env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  console.log(`[lobby] spawned bot combat client pid=${child.pid}`);
}
