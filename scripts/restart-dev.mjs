#!/usr/bin/env node
import { startDev } from './lib/start-service.mjs';
import { stopDev } from './lib/stop-service.mjs';
import { webClientUrl } from './lib/dev-config.mjs';

const useTerminal = process.argv.includes('--terminal');
const headless =
  process.argv.includes('--headless') ||
  process.env.GRECKON_HEADLESS === '1' ||
  !useTerminal;
const skipBuild = process.argv.includes('--no-build') || process.env.GRECKON_SKIP_BUILD === '1';
const openBrowser =
  process.argv.includes('--open') || process.env.GRECKON_OPEN_BROWSER === '1';

console.log('[greckon] restarting dev stack...');
await stopDev();

await startDev({
  headless,
  build: !skipBuild,
  openBrowser,
  skipPortKill: true,
});

console.log(`[greckon] reload your browser: ${webClientUrl()}`);
if (useTerminal) {
  console.log('[greckon] close any older Greckon Lobby terminal windows from a previous pnpm start');
}
