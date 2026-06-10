#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { clearPid, rootDir, writePid } from './lib/process.mjs';
import { clientEnv, clientEntryPath, clientPidName } from './lib/dev-config.mjs';

const username = process.argv[2] ?? process.env.GRECKON_USERNAME ?? 'player';
const name = clientPidName(username);

async function cleanup() {
  await clearPid(name);
}

function shutdownChild(signal = 'SIGTERM') {
  if (child && !child.killed) {
    child.kill(signal);
  }
}

process.on('SIGINT', () => {
  shutdownChild('SIGINT');
  void cleanup().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  shutdownChild('SIGTERM');
  void cleanup().finally(() => process.exit(0));
});

await writePid(name, process.pid);

console.log(`[client] starting as ${username}`);

const child = spawn(process.execPath, [clientEntryPath(), username], {
  cwd: rootDir,
  env: clientEnv(username),
  stdio: 'inherit',
});

child.on('exit', (code) => {
  void cleanup().finally(() => process.exit(code ?? 0));
});
