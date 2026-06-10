import { loadGameConfig } from '@greckon/core';
import { pathToFileURL } from 'node:url';
import { runGameplayLoop } from './gameplay-loop.js';
import { createClientStateMachine } from './state/client-state-machine.js';

export async function main(): Promise<void> {
  const username = process.argv[2] ?? process.env.GRECKON_USERNAME ?? 'player';
  const config = loadGameConfig();
  const machine = createClientStateMachine(config);

  console.log(
    `[client] config: maxRounds=${config.maxRounds} turnWindow=${config.turnWindowSeconds}s`,
  );

  if (process.env.GRECKON_RUN_ONCE === '1') {
    await runGameplayLoop(username, machine);
    return;
  }

  while (true) {
    await runGameplayLoop(username, machine);
    if (machine.screen === 'loading') {
      await machine.tick();
    }
  }
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
