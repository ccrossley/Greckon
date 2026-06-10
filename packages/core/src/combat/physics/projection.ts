import { getCombatTuning } from '../../config/combat-tuning.js';
import { fieldScale, fieldXToWorld, fieldZToWorld } from './coords.js';

export interface ScreenPoint {
  /** Normalized 0–1 horizontal screen position. */
  screenX: number;
  /** Normalized 0–1 vertical screen position (SVG Y). */
  screenY: number;
}

/**
 * Project world position to normalized screen coords for the arena SVG.
 * Camera looks ~20° off vertical toward the bottom player (+Z).
 */
export function projectWorldToScreen(
  fieldX: number,
  fieldZ: number,
  worldHeightM: number,
  cameraPitchDeg = getCombatTuning().physics.cameraPitchDeg,
): ScreenPoint {
  const scale = fieldScale();
  const wx = fieldXToWorld(fieldX);
  const wz = fieldZToWorld(fieldZ);
  const pitch = (cameraPitchDeg * Math.PI) / 180;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  // Tilted orthographic: depth pushes screen Y, height lifts screen Y.
  const screenX = fieldX;
  const depthOffset = (wz / scale) * sinP;
  const heightOffset = worldHeightM / scale;
  const rawY = fieldZ - depthOffset * 0.35 - heightOffset;
  const screenY = Math.max(0.02, Math.min(0.98, rawY));

  return { screenX, screenY };
}
