#!/usr/bin/env node
import { startClientDetached, startClientInTerminal, ensureBuilt } from './lib/start-service.mjs';

const username = process.argv[2] ?? process.env.GRECKON_USERNAME ?? 'player';
const headless = process.argv.includes('--headless') || process.env.GRECKON_HEADLESS === '1';

await ensureBuilt();

if (headless) {
  await startClientDetached(username);
} else {
  await startClientInTerminal(username);
}
