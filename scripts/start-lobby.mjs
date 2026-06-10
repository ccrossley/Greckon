#!/usr/bin/env node
import { startLobbyDetached, startLobbyInTerminal, ensureBuilt } from './lib/start-service.mjs';

const headless = process.argv.includes('--headless') || process.env.GRECKON_HEADLESS === '1';

await ensureBuilt();

if (headless) {
  await startLobbyDetached();
} else {
  await startLobbyInTerminal();
}
