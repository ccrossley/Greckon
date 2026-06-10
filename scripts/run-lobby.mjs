#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { clearPid, killPort, rootDir, writePid } from './lib/process.mjs';
import { devConfig, lobbyEnv, lobbyEntryPath } from './lib/dev-config.mjs';

const name = 'lobby';

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

await killPort(Number(devConfig.env.GRECKON_HTTP_PORT));
await killPort(Number(devConfig.env.GRECKON_CLIENT_WS_PORT));

console.log(`[lobby] starting from ${rootDir}`);
console.log(`[lobby] API http://localhost:${lobbyEnv().GRECKON_HTTP_PORT ?? 3000}`);

const child = spawn(process.execPath, [lobbyEntryPath()], {
  cwd: rootDir,
  env: lobbyEnv(),
  stdio: 'inherit',
});

child.on('exit', (code) => {
  void cleanup().finally(() => process.exit(code ?? 0));
});
