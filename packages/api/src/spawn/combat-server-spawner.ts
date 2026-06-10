import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface CombatServerHandle {
  pid: number;
  serverId: string;
  kill(): Promise<void>;
}

const handles: CombatServerHandle[] = [];
let childProcess: ChildProcess | null = null;

function combatServerEntry(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '../../../combat-server/dist/bootstrap.js');
}

export interface SpawnOptions {
  lobbyWsUrl: string;
  clientWsPort: number;
}

export function spawnCombatServer(
  options: SpawnOptions = {
    lobbyWsUrl: process.env.GRECKON_LOBBY_WS_URL ?? 'ws://localhost:3000/combat-registry',
    clientWsPort: Number(process.env.GRECKON_CLIENT_WS_PORT ?? 4001),
  },
): CombatServerHandle {
  const serverId = randomUUID();
  const entry = combatServerEntry();
  childProcess = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      GRECKON_LOBBY_WS_URL: options.lobbyWsUrl,
      GRECKON_SERVER_ID: serverId,
      GRECKON_CLIENT_WS_PORT: String(options.clientWsPort),
      GRECKON_RECONNECT_TIMEOUT_SECONDS: process.env.GRECKON_RECONNECT_TIMEOUT_SECONDS ?? '30',
    },
    stdio: 'inherit',
  });

  const handle: CombatServerHandle = {
    pid: childProcess.pid ?? 0,
    serverId,
    async kill() {
      if (!childProcess || childProcess.killed) {
        return;
      }
      childProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        childProcess?.once('exit', () => resolve());
        setTimeout(() => {
          childProcess?.kill('SIGKILL');
          resolve();
        }, 5000);
      });
      childProcess = null;
    },
  };
  handles.push(handle);
  childProcess.on('exit', () => {
    const index = handles.indexOf(handle);
    if (index >= 0) {
      handles.splice(index, 1);
    }
  });
  return handle;
}

export function killAllCombatServers(): Promise<void> {
  return Promise.all(handles.map((handle) => handle.kill())).then(() => undefined);
}

export function getSpawnedHandles(): CombatServerHandle[] {
  return [...handles];
}
