import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadArchetypes(dataDir) {
  return JSON.parse(readFileSync(join(dataDir, 'archetypes.json'), 'utf8'));
}

export function substituteTokens(template, unit, archetypes) {
  const anatomy = archetypes.factionAnatomy[unit.factionId] ?? 'fantasy creature';
  return template
    .replaceAll('{anatomy}', anatomy)
    .replaceAll('{fillColor}', unit.fillColor)
    .replaceAll('{unitName}', unit.name);
}

export function sceneForUnit(unit, archetypes) {
  if (archetypes.sceneOverrides?.[unit.id]) {
    return archetypes.sceneOverrides[unit.id];
  }
  const archetype = archetypes.bySides[String(unit.sides)];
  if (!archetype) {
    throw new Error(`No archetype for unit ${unit.id} (sides=${unit.sides})`);
  }
  if (archetype.scene) {
    return substituteTokens(archetype.scene, unit, archetypes);
  }
  throw new Error(`No scene template for unit ${unit.id}`);
}
