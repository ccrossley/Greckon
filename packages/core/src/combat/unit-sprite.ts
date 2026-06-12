import {
  PAPER_DOLL_ATLAS,
  PAPER_DOLL_BY_UNIT,
  PAPER_DOLL_CANVAS_SIZE,
  PAPER_DOLL_RIGS,
} from '../generated/paper-dolls.js';
import type { UnitType } from '../generated/units.js';

export {
  PAPER_DOLL_ATLAS as UNIT_SPRITE_ATLAS,
  PAPER_DOLL_CANVAS_SIZE as UNIT_SPRITE_CANVAS_SIZE,
  PAPER_DOLL_RIGS as UNIT_SPRITE_CATALOG,
};
export type { PaperDollRigId as UnitSpriteId } from '../generated/paper-dolls.js';

/** @deprecated Use UNIT_SPRITE_CATALOG */
export { PAPER_DOLL_ATLAS, PAPER_DOLL_CANVAS_SIZE, PAPER_DOLL_RIGS };

export type UnitSprite = (typeof PAPER_DOLL_RIGS)[number];

export interface UnitSpriteDisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface UnitSpriteDimensions {
  width: number;
  height: number;
}

const DEFAULT_DISPLAY_BOUNDS: UnitSpriteDisplayBounds = {
  x: 0,
  y: 0,
  width: PAPER_DOLL_CANVAS_SIZE,
  height: PAPER_DOLL_CANVAS_SIZE,
  centerX: PAPER_DOLL_CANVAS_SIZE / 2,
  centerY: PAPER_DOLL_CANVAS_SIZE / 2,
};

export function resolveUnitSpriteId(unitKey: UnitType | string): string | undefined {
  return unitKey in PAPER_DOLL_BY_UNIT ? unitKey : undefined;
}

export function hasUnitSprite(unitKey: UnitType | string): boolean {
  return resolveUnitSpriteId(unitKey) !== undefined;
}

export function getUnitSprite(unitKey: UnitType | string): UnitSprite | undefined {
  const id = resolveUnitSpriteId(unitKey);
  return id ? PAPER_DOLL_BY_UNIT[id] : undefined;
}

export function getUnitSpriteUrl(spriteId: string): string {
  const meta = PAPER_DOLL_ATLAS[spriteId as keyof typeof PAPER_DOLL_ATLAS];
  if (!meta) {
    throw new Error(`Missing unit sprite for: ${spriteId}`);
  }
  return `/paper-dolls/${meta.spriteFile}`;
}

export function getUnitSpriteDimensions(spriteId: string): UnitSpriteDimensions {
  const meta = PAPER_DOLL_ATLAS[spriteId as keyof typeof PAPER_DOLL_ATLAS];
  if (!meta) {
    throw new Error(`Missing unit sprite metadata for: ${spriteId}`);
  }
  return { width: meta.spriteWidth, height: meta.spriteHeight };
}

export function getUnitSpriteDisplayBounds(spriteId: string): UnitSpriteDisplayBounds {
  const meta = PAPER_DOLL_ATLAS[spriteId as keyof typeof PAPER_DOLL_ATLAS];
  const bounds = (meta as { displayBounds?: UnitSpriteDisplayBounds } | undefined)?.displayBounds;
  return bounds ?? DEFAULT_DISPLAY_BOUNDS;
}

/** Scale sprite content to fill the icon viewBox (matches vector icon footprint). */
export function getUnitSpriteFitScale(spriteId: string, padding = 0.92): number {
  const bounds = getUnitSpriteDisplayBounds(spriteId);
  return (PAPER_DOLL_CANVAS_SIZE * padding) / Math.max(bounds.width, bounds.height, 1);
}

export function getUnitSpritePlacement(sprite: UnitSprite): { x: number; y: number } {
  const { width, height } = getUnitSpriteDimensions(sprite.id);
  const [anchorX, anchorY] = sprite.anchor;
  return {
    x: PAPER_DOLL_CANVAS_SIZE * anchorX - width * anchorX,
    y: PAPER_DOLL_CANVAS_SIZE * anchorY - height * anchorY,
  };
}
