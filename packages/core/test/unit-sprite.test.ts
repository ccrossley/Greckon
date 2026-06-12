import { describe, expect, it } from 'vitest';
import {
  getUnitSprite,
  getUnitSpriteDisplayBounds,
  getUnitSpriteFitScale,
  getUnitSpriteDimensions,
  getUnitSpritePlacement,
  getUnitSpriteUrl,
  hasUnitSprite,
  PAPER_DOLL_RIGS,
} from '../src/combat/unit-sprite.js';

describe('unit sprite catalog', () => {
  it('includes bullfrog_knight with sprite metadata', () => {
    expect(hasUnitSprite('bullfrog_knight')).toBe(true);
    const sprite = getUnitSprite('bullfrog_knight');
    expect(sprite).toBeDefined();
    expect(sprite?.unitId).toBe('bullfrog_knight');
    expect(sprite?.id).toBe('bullfrog_knight');
    expect(getUnitSpriteUrl('bullfrog_knight')).toBe('/paper-dolls/bullfrog_knight.png');
  });

  it('computes display bounds and fit scale from catalog', () => {
    const bounds = getUnitSpriteDisplayBounds('bullfrog_knight');
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.centerX).toBeGreaterThan(0);
    expect(bounds.centerY).toBeGreaterThan(0);

    const fitScale = getUnitSpriteFitScale('bullfrog_knight');
    const bounds2 = getUnitSpriteDisplayBounds('bullfrog_knight');
    expect(fitScale).toBeGreaterThan(0);
    expect(fitScale * bounds2.width).toBeLessThanOrEqual(512);
  });

  it('places sprite on canvas using anchor', () => {
    const sprite = getUnitSprite('bullfrog_knight')!;
    const placement = getUnitSpritePlacement(sprite);
    const { width, height } = getUnitSpriteDimensions(sprite.id);
    expect(placement.x).toBeGreaterThanOrEqual(0);
    expect(placement.y).toBeGreaterThanOrEqual(0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('includes tadpole_squire', () => {
    expect(hasUnitSprite('tadpole_squire')).toBe(true);
    const sprite = getUnitSprite('tadpole_squire');
    expect(sprite?.unitId).toBe('tadpole_squire');
  });

  it('has an entry for every catalog rig', () => {
    for (const rig of PAPER_DOLL_RIGS) {
      const unitId = rig.unitId;
      expect(hasUnitSprite(unitId)).toBe(true);
      const sprite = getUnitSprite(unitId);
      expect(sprite?.id).toBe(rig.id);
    }
  });
});
