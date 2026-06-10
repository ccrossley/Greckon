import { join } from 'node:path';
import { rootDir } from './process.mjs';

/** Single source of truth for local dev startup. */
export const devConfig = {
  /** CLI combat clients; empty by default — play in the browser at http://localhost:3000 */
  players: (process.env.GRECKON_PLAYERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
  botUsername: process.env.GRECKON_BOT_USERNAME ?? 'opponent',
  waitForLobbyMs: Number(process.env.GRECKON_WAIT_FOR_LOBBY_MS ?? 2000),
  openBrowser: process.env.GRECKON_OPEN_BROWSER !== '0',
  env: {
    GRECKON_HTTP_PORT: process.env.GRECKON_HTTP_PORT ?? '3000',
    GRECKON_HOST: process.env.GRECKON_HOST ?? 'localhost',
    GRECKON_CLIENT_WS_PORT: process.env.GRECKON_CLIENT_WS_PORT ?? '4001',
    GRECKON_API_URL: process.env.GRECKON_API_URL ?? 'http://localhost:3000',
    GRECKON_RECONNECT_TIMEOUT_SECONDS: process.env.GRECKON_RECONNECT_TIMEOUT_SECONDS ?? '30',
  },
};

export function webClientUrl() {
  const { GRECKON_HOST, GRECKON_HTTP_PORT } = devConfig.env;
  return `http://${GRECKON_HOST}:${GRECKON_HTTP_PORT}/`;
}

export function clientPidName(username) {
  return `client-${username}`;
}

export function lobbyEntryPath() {
  return join(rootDir, 'packages/api/dist/main.js');
}

export function clientEntryPath() {
  return join(rootDir, 'packages/combat-client/dist/main.js');
}

export function lobbyEnv() {
  return {
    ...process.env,
    ...devConfig.env,
  };
}

export function clientEnv(username) {
  return {
    ...process.env,
    ...devConfig.env,
    GRECKON_USERNAME: username,
    GRECKON_RUN_ONCE: '1',
  };
}

export function nodeBin() {
  return process.execPath;
}

export function runLobbyShellCommand() {
  const node = nodeBin();
  const entry = lobbyEntryPath();
  const env = devConfig.env;
  return [
    `cd ${shellQuote(rootDir)}`,
    `export GRECKON_HTTP_PORT=${shellQuote(env.GRECKON_HTTP_PORT)}`,
    `export GRECKON_HOST=${shellQuote(env.GRECKON_HOST)}`,
    `export GRECKON_CLIENT_WS_PORT=${shellQuote(env.GRECKON_CLIENT_WS_PORT)}`,
    `${shellQuote(node)} ${shellQuote(join(rootDir, 'scripts/run-lobby.mjs'))}`,
  ].join(' && ');
}

export function runClientShellCommand(username) {
  const node = nodeBin();
  const env = devConfig.env;
  return [
    `cd ${shellQuote(rootDir)}`,
    `export GRECKON_API_URL=${shellQuote(env.GRECKON_API_URL)}`,
    `export GRECKON_RUN_ONCE=1`,
    `${shellQuote(node)} ${shellQuote(join(rootDir, 'scripts/run-client.mjs'))} ${shellQuote(username)}`,
  ].join(' && ');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
