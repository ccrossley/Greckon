import { pathToFileURL } from 'node:url';
import { bootstrap } from './index.js';

export async function main(): Promise<void> {
  await bootstrap({
    lobbyWsUrl: process.env.GRECKON_LOBBY_WS_URL ?? 'ws://localhost:3001/combat-registry',
    serverId: process.env.GRECKON_SERVER_ID ?? 'combat-server-local',
    clientWsPort: Number(process.env.GRECKON_CLIENT_WS_PORT ?? 4001),
    reconnectTimeoutSeconds: Number(process.env.GRECKON_RECONNECT_TIMEOUT_SECONDS ?? 30),
  });
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
