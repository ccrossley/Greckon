import { readdir } from 'node:fs/promises';
import { killPort, stopProcess, waitForPortFree, runtimeDir } from './process.mjs';
import { clientPidName, devConfig } from './dev-config.mjs';

/** Stop lobby, CLI clients, and free dev ports. */
export async function stopDev() {
  await stopProcess('lobby');

  for (const player of devConfig.players) {
    await stopProcess(clientPidName(player));
  }

  await stopProcess('client');

  try {
    const files = await readdir(runtimeDir);
    for (const file of files) {
      if (file.startsWith('client-') && file.endsWith('.pid')) {
        await stopProcess(file.slice(0, -'.pid'.length));
      }
    }
  } catch {
    // no runtime dir yet
  }

  await killPort(Number(devConfig.env.GRECKON_HTTP_PORT));
  await killPort(Number(devConfig.env.GRECKON_CLIENT_WS_PORT));
  await waitForPortFree(Number(devConfig.env.GRECKON_HTTP_PORT));
  await waitForPortFree(Number(devConfig.env.GRECKON_CLIENT_WS_PORT));

  console.log('[greckon] all processes stopped');
}
