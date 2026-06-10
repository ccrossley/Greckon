#!/usr/bin/env node
import { startDev } from './lib/start-service.mjs';

const headless = process.argv.includes('--headless') || process.env.GRECKON_HEADLESS === '1';

await startDev({ headless });
