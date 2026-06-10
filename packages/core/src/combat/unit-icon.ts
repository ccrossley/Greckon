import { ICON_SLUG_PATHS, UNIT_ICON_PATHS, UNIT_ICON_SIZE } from '../generated/unit-icons.js';
import type { UnitType } from '../generated/units.js';

export { ICON_SLUG_PATHS, UNIT_ICON_SIZE, UNIT_ICON_PATHS };

export function listIconSlugs(): string[] {
  return Object.keys(ICON_SLUG_PATHS).sort();
}

export function getIconPathBySlug(slug: string): string | undefined {
  return ICON_SLUG_PATHS[slug];
}

export function getUnitIconPath(unitType: UnitType): string {
  const path = UNIT_ICON_PATHS[unitType];
  if (!path) {
    throw new Error(`Missing icon path for unit type: ${unitType}`);
  }
  return path;
}

/** Stroke width in game-icons path coordinates (512×512 viewBox). */
export const UNIT_ICON_STROKE_WIDTH = 14;

/** Scale factor to fit a game-icons path (512×512) into arena coordinates. */
export function getUnitIconScale(visualRadius: number, padding = 0.92): number {
  return (visualRadius * 2 * padding) / UNIT_ICON_SIZE;
}
