#!/usr/bin/env node
/**
 * Copy prepared public sprites as preview PNGs for quick QA.
 *
 * Usage:
 *   node scripts/paper-doll-preview.mjs
 *   node scripts/paper-doll-preview.mjs bullfrog_knight dreamweaver
 */
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dataDir = join(repoRoot, 'data/paper-dolls');
const publicDir = join(repoRoot, 'packages/web/public/paper-dolls');

const filter = process.argv.slice(2);

function allUnitIds() {
  return readdirSync(dataDir)
    .filter(
      (name) =>
        name.endsWith('.json') &&
        !name.includes('-img2img') &&
        name !== 'archetypes.json',
    )
    .map((name) => name.replace(/\.json$/, ''));
}

const unitIds = filter.length > 0 ? filter : allUnitIds();
let copied = 0;

for (const unitId of unitIds) {
  const src = join(publicDir, `${unitId}.png`);
  const dest = join(publicDir, `${unitId}-preview.png`);
  if (!existsSync(src)) {
    console.warn(`skip ${unitId}: missing ${src}`);
    continue;
  }
  copyFileSync(src, dest);
  copied += 1;
}

console.log(`Preview copies: ${copied}`);
