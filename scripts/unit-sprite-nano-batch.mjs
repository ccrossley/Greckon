#!/usr/bin/env node
/**
 * Generate unit sprites via Nano Banana 2 Edit on AtlasCloud (triplet batches).
 *
 * Usage:
 *   ATLASCLOUD_API_KEY=... node scripts/unit-sprite-nano-batch.mjs the_croak koala_horde
 *   node scripts/unit-sprite-nano-batch.mjs --prompts-only the_croak
 *   ATLASCLOUD_API_KEY=... node scripts/unit-sprite-nano-batch.mjs --force the_croak
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateNanoBananaEdit } from './lib/atlas-generate.mjs';
import { loadArchetypes, sceneForUnit } from './lib/unit-sprite-scenes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const dataDir = join(repoRoot, 'data/paper-dolls');
const outDir = join(dataDir, 'nano-batches');
const assetsDir = join(repoRoot, 'assets/paper-dolls');
const splitScript = join(repoRoot, 'scripts/split-triplet-sprites.py');

const args = process.argv.slice(2);
const promptsOnly = args.includes('--prompts-only');
const force = args.includes('--force');
const skipCompile = args.includes('--no-compile');
const factionFilter = args.filter((arg) => !arg.startsWith('--'));

const units = JSON.parse(readFileSync(join(repoRoot, 'data/units.json'), 'utf8'));
const archetypes = loadArchetypes(dataDir);

const DEFAULT_FACTIONS = ['the_croak', 'koala_horde'];
const factions = [...new Set(factionFilter.length > 0 ? factionFilter : DEFAULT_FACTIONS)];

function unitScene(unit) {
  const spritePath = join(dataDir, `${unit.id}.json`);
  if (existsSync(spritePath)) {
    const sprite = JSON.parse(readFileSync(spritePath, 'utf8'));
    if (sprite.scenePrompt) {
      return sprite.scenePrompt;
    }
  }
  return sceneForUnit(unit, archetypes);
}

function listStyleReferences() {
  const refDir = archetypes.styleReferenceDir;
  if (!refDir || !existsSync(refDir)) {
    throw new Error(`Missing styleReferenceDir: ${refDir}`);
  }
  const refs = readdirSync(refDir)
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .map((name) => join(refDir, name))
    .sort();
  if (refs.length === 0) {
    throw new Error(`No reference images in ${refDir}`);
  }
  return refs;
}

function chunkTriplets(items) {
  const batches = [];
  for (let i = 0; i < items.length; i += 3) {
    batches.push(items.slice(i, i + 3));
  }
  return batches;
}

function buildTripletPrompt(triplet) {
  const scenes = triplet.map((unit) => unitScene(unit));
  const [a, b, c] = scenes;
  const top = `Show three separate characters side by side: ${a}; ${b}; and ${c}. All three are spaced out horizontally and not overlapping. Neutral stance.`;
  return `${top}\n\n${archetypes.nanoBananaStyleSuffix}`;
}

function buildSinglePrompt(unit) {
  const top = `${unitScene(unit)}. Single character, neutral stance, centered.`;
  return `${top}\n\n${archetypes.nanoBananaStyleSuffix}`;
}

function buildManifest(styleRefs) {
  mkdirSync(outDir, { recursive: true });
  const manifest = { styleReferences: styleRefs, batches: [] };

  for (const factionId of factions) {
    const factionUnits = units
      .filter((unit) => unit.factionId === factionId && unit.paperDollId)
      .sort((left, right) => left.sides - right.sides);

    chunkTriplets(factionUnits).forEach((triplet, index) => {
      const batchId = `${factionId}-batch-${index + 1}`;
      const unitIds = triplet.map((unit) => unit.id);
      const prompt = triplet.length === 3 ? buildTripletPrompt(triplet) : buildSinglePrompt(triplet[0]);
      const batch = {
        id: batchId,
        factionId,
        unitIds,
        model: archetypes.nanoBananaModel,
        prompt,
        styleReferences: styleRefs,
      };
      manifest.batches.push(batch);
      writeFileSync(join(outDir, `${batchId}.txt`), `${prompt}\n`, 'utf8');
      writeFileSync(join(outDir, `${batchId}.json`), `${JSON.stringify(batch, null, 2)}\n`, 'utf8');
      console.log(`${batchId}: ${unitIds.join(', ')}`);
    });
  }

  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function splitBatch(batch) {
  const src = join(outDir, `${batch.id}.png`);
  if (!existsSync(src)) {
    throw new Error(`Missing batch image: ${src}`);
  }
  execFileSync('python3', [splitScript, src, ...batch.unitIds], { stdio: 'inherit' });
}

const styleRefs = listStyleReferences();
const manifest = buildManifest(styleRefs);
console.log(`\n${manifest.batches.length} batch(es), ${styleRefs.length} style reference(s)`);

if (promptsOnly) {
  process.exit(0);
}

const apiKey = process.env.ATLASCLOUD_API_KEY;
if (!apiKey) {
  console.error('\nSet ATLASCLOUD_API_KEY to generate (same key as atlas-image MCP).');
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });

for (const batch of manifest.batches) {
  const outPath = join(outDir, `${batch.id}.png`);
  if (!force && existsSync(outPath)) {
    console.log(`→ skip generate ${batch.id} (exists)`);
  } else {
    console.log(`→ generate ${batch.id} (${batch.model})...`);
    await generateNanoBananaEdit({
      apiKey,
      model: batch.model,
      prompt: batch.prompt,
      referencePaths: batch.styleReferences,
      aspectRatio: archetypes.nanoBananaAspectRatio ?? '21:9',
      resolution: archetypes.nanoBananaResolution ?? '1k',
      outputPath: outPath,
    });
    console.log(`  ✓ ${outPath}`);
  }
  console.log(`→ split ${batch.id}...`);
  splitBatch(batch);
}

if (!skipCompile) {
  console.log('\n→ compile sprites...');
  execFileSync('node', ['scripts/compile-paper-dolls.mjs'], { cwd: repoRoot, stdio: 'inherit' });
  execFileSync('node', ['scripts/paper-doll-preview.mjs'], { cwd: repoRoot, stdio: 'inherit' });
}

console.log('\nNano Banana unit sprite batch complete.');
