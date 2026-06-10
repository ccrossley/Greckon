import { FIELD_X_MAX, FIELD_X_MIN, getUnitBodyRadius } from '../field-layout.js';
import { MAX_UNIT_LEVEL } from '../visual.js';
import { getCombatTuning } from '../../config/combat-tuning.js';

/** Field depth bounds (CombatUnit.y / world Z). */
export const FIELD_Z_MIN = FIELD_X_MIN;
export const FIELD_Z_MAX = FIELD_X_MAX;

export function fieldScale(): number {
  return getCombatTuning().physics.fieldScale;
}

/** Normalized field X → world X (meters). */
export function fieldXToWorld(x: number): number {
  return x * fieldScale();
}

/** Normalized field depth (CombatUnit.y) → world Z (meters). */
export function fieldZToWorld(z: number): number {
  return z * fieldScale();
}

/** World X → normalized field X. */
export function worldXToField(x: number): number {
  return x / fieldScale();
}

/** World Z → normalized field depth (CombatUnit.y). */
export function worldZToField(z: number): number {
  return z / fieldScale();
}

export function clampFieldX(value: number): number {
  return Math.max(FIELD_X_MIN, Math.min(FIELD_X_MAX, value));
}

export function clampFieldZ(value: number): number {
  return Math.max(FIELD_Z_MIN, Math.min(FIELD_Z_MAX, value));
}

export function horizontalDistanceField(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const scale = fieldScale();
  return Math.hypot((ax - bx) * scale, (az - bz) * scale);
}

/** Sphere collider radius in world meters. */
export function worldBodyRadius(level = 1): number {
  return getUnitBodyRadius(level) * fieldScale();
}

/** Playable world bounds inset so sphere centers stay inside walls. */
export function playableWorldBounds(): { xMin: number; xMax: number; zMin: number; zMax: number } {
  const padding = getCombatTuning().physics.wallInsetPadding + worldBodyRadius(MAX_UNIT_LEVEL);
  return {
    xMin: fieldXToWorld(FIELD_X_MIN) + padding,
    xMax: fieldXToWorld(FIELD_X_MAX) - padding,
    zMin: fieldZToWorld(FIELD_Z_MIN) + padding,
    zMax: fieldZToWorld(FIELD_Z_MAX) - padding,
  };
}
