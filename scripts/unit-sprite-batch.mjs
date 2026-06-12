#!/usr/bin/env node
/**
 * Scaffold + Nano Banana generate + compile unit sprites for faction units.
 *
 * Usage:
 *   ATLASCLOUD_API_KEY=... node scripts/unit-sprite-batch.mjs the_croak koala_horde
 *   node scripts/unit-sprite-batch.mjs --no-scaffold --prompts-only the_croak
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const noScaffold = args.includes('--no-scaffold');
const passThrough = args.filter((arg) => arg !== '--no-scaffold');
const factions = passThrough.filter((arg) => !arg.startsWith('--'));

if (factions.length === 0) {
  console.error('Usage: node scripts/unit-sprite-batch.mjs [--no-scaffold] [--force] [--prompts-only] <factionId>...');
  process.exit(1);
}

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!noScaffold) {
  run('node', ['scripts/scaffold-paper-dolls.mjs', '--force', ...factions]);
}

run('node', ['scripts/unit-sprite-nano-batch.mjs', ...passThrough]);

if (!passThrough.includes('--prompts-only')) {
  run('node', ['scripts/compile-units.mjs']);
}
