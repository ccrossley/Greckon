#!/usr/bin/env node

if (process.env.RENDER === 'true') {
  const { main } = await import('../packages/api/dist/main.js');
  await main();
} else {
  const { startDev } = await import('./lib/start-service.mjs');
  const headless = process.argv.includes('--headless') || process.env.GRECKON_HEADLESS === '1';
  await startDev({ headless });
}
