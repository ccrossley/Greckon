#!/usr/bin/env node
/** @deprecated Use scripts/unit-sprite-batch.mjs */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
console.warn('paper-doll-faction-batch.mjs is deprecated — use unit-sprite-batch.mjs');
const result = spawnSync('node', ['scripts/unit-sprite-batch.mjs', ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
