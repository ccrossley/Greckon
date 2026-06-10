import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILL_COLOR,
  getHealthBorderColor,
  getUpgradeFillColor,
  isCriticalHealth,
  resolveUnitFillColor,
} from '../src/index.js';

describe('combat visual helpers', () => {
  it('returns grey at level 1 and purple at max upgrade level', () => {
    expect(getUpgradeFillColor(1)).toBe('#808080');
    expect(getUpgradeFillColor(4)).toBe('#9333ea');
  });

  it('uses custom fill color at level 1 for spectrum mode', () => {
    expect(resolveUnitFillColor({ fillColor: '#ff0000', upgradeColorMod: 'spectrum' }, 1)).toBe('#ff0000');
    expect(resolveUnitFillColor({ fillColor: '#ff0000', upgradeColorMod: 'spectrum' }, 4)).toBe('#9333ea');
  });

  it('defaults missing appearance to legacy grey/purple spectrum', () => {
    expect(resolveUnitFillColor(undefined, 1)).toBe(DEFAULT_FILL_COLOR);
    expect(resolveUnitFillColor(undefined, 4)).toBe('#9333ea');
  });

  it('supports hue_shift upgrade mod', () => {
    const level1 = resolveUnitFillColor({ fillColor: '#0080ff', upgradeColorMod: 'hue_shift' }, 1);
    const level4 = resolveUnitFillColor({ fillColor: '#0080ff', upgradeColorMod: 'hue_shift' }, 4);
    expect(level1).toMatch(/^#[0-9a-f]{6}$/i);
    expect(level4).not.toBe(level1);
  });

  it('supports lighten upgrade mod', () => {
    const level1 = resolveUnitFillColor({ fillColor: '#404040', upgradeColorMod: 'lighten' }, 1);
    const level4 = resolveUnitFillColor({ fillColor: '#404040', upgradeColorMod: 'lighten' }, 4);
    expect(level1).toBe('#404040');
    expect(level4).not.toBe(level1);
  });

  it('supports saturate upgrade mod', () => {
    const level1 = resolveUnitFillColor({ fillColor: '#808080', upgradeColorMod: 'saturate' }, 1);
    const level4 = resolveUnitFillColor({ fillColor: '#808080', upgradeColorMod: 'saturate' }, 4);
    expect(level1).toBe('#808080');
    expect(level4).not.toBe(level1);
  });

  it('returns green at full health and yellow near half', () => {
    expect(getHealthBorderColor(1)).toMatch(/^#22c55e$/i);
    expect(getHealthBorderColor(0.5)).toMatch(/^#ffff00$/i);
  });

  it('flags critical health at 10 percent or below', () => {
    expect(isCriticalHealth(0.1)).toBe(true);
    expect(isCriticalHealth(0.2)).toBe(false);
  });
});
