import { pathToFileURL } from 'node:url';
import { createApiServer } from './server/create-api-server.js';
import { shutdownApi } from './shutdown.js';

export async function main(): Promise<void> {
  if (process.env.RENDER_EXTERNAL_HOSTNAME && !process.env.GRECKON_HOST) {
    process.env.GRECKON_HOST = process.env.RENDER_EXTERNAL_HOSTNAME;
  }

  const config = {
    httpPort: Number(process.env.PORT ?? process.env.GRECKON_HTTP_PORT ?? 3000),
    lobbyWsPath: process.env.GRECKON_LOBBY_WS_PATH ?? '/lobby',
    combatRegistryWsPath: process.env.GRECKON_COMBAT_REGISTRY_PATH ?? '/combat-registry',
  };

  const server = await createApiServer(config);
  await server.start();

  const stop = async (signal: string) => {
    console.log(`[lobby] received ${signal}, shutting down...`);
    await shutdownApi();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
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
