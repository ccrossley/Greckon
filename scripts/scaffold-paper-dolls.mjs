#!/usr/bin/env node
/**
 * Generate per-unit sprite metadata from archetypes.json and units.json.
 *
 * Usage:
 *   node scripts/scaffold-paper-dolls.mjs the_croak koala_horde
 *   node scripts/scaffold-paper-dolls.mjs --force ironbark_knight
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArchetypes, sceneForUnit } from './lib/unit-sprite-scenes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dataDir = join(repoRoot, 'data/paper-dolls');

const args = process.argv.slice(2);
const force = args.includes('--force');
const factionFilter = args.filter((arg) => !arg.startsWith('--'));

const units = JSON.parse(readFileSync(join(repoRoot, 'data/units.json'), 'utf8'));
const archetypes = loadArchetypes(dataDir);

const DEFAULT_FACTIONS = ['the_croak', 'koala_horde'];
const factions = factionFilter.length > 0 ? factionFilter : DEFAULT_FACTIONS;

function buildSprite(unit) {
  return {
    id: unit.id,
    unitId: unit.id,
    canvasSize: archetypes.canvasSize,
    sprite: `${unit.id}.png`,
    anchor: archetypes.anchor ?? [0.5, 0.92],
    scenePrompt: sceneForUnit(unit, archetypes),
  };
}

let created = 0;
let skipped = 0;

for (const unit of units) {
  if (!factions.includes(unit.factionId)) {
    continue;
  }

  const spritePath = join(dataDir, `${unit.id}.json`);
  if (!force && existsSync(spritePath)) {
    skipped += 1;
    continue;
  }

  if (!archetypes.bySides[String(unit.sides)]) {
    console.error(`No archetype for unit ${unit.id} (sides=${unit.sides})`);
    process.exit(1);
  }

  writeFileSync(spritePath, `${JSON.stringify(buildSprite(unit), null, 2)}\n`, 'utf8');
  console.log(`scaffolded ${unit.id} (sides=${unit.sides})`);
  created += 1;
}

console.log(`\nScaffold complete: ${created} created, ${skipped} skipped`);
