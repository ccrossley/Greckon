const WARM_RED = { r: 255, g: 100, b: 100 };

import type { UpgradeColorMod } from '../types/combat-enums.js';

export type { UpgradeColorMod } from '../types/combat-enums.js';

export interface UnitAppearance {
  fillColor?: string;
  upgradeColorMod?: UpgradeColorMod;
}

export const DEFAULT_FILL_COLOR = '#808080';
export const DEFAULT_UPGRADE_COLOR_MOD: UpgradeColorMod = 'spectrum';
export const MAX_UPGRADE_FILL_COLOR = '#9333ea';

/** Base level 1 plus up to 3 upgrades per unit type. */
export const MAX_UNIT_LEVEL = 4;

/** Arena display size in SVG viewBox units (0–100); not tied to sim collision size. */
export const UNIT_VISUAL_RADIUS = 1.15;
export const UNIT_STROKE_WIDTH = UNIT_VISUAL_RADIUS * 0.14;

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${lerp(0, 255, r / 255).toString(16).padStart(2, '0')}${lerp(0, 255, g / 255).toString(16).padStart(2, '0')}${lerp(0, 255, b / 255).toString(16).padStart(2, '0')}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) => lerp(0, 255, v + m).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function normalizeUnitAppearance(appearance?: Partial<UnitAppearance>): Required<UnitAppearance> {
  return {
    fillColor: appearance?.fillColor ?? DEFAULT_FILL_COLOR,
    upgradeColorMod: appearance?.upgradeColorMod ?? DEFAULT_UPGRADE_COLOR_MOD,
  };
}

function resolveSpectrumFillColor(fillColor: string, level: number): string {
  const clamped = Math.min(MAX_UNIT_LEVEL, Math.max(1, level));
  if (clamped === 1) {
    return fillColor;
  }
  if (clamped === MAX_UNIT_LEVEL) {
    return MAX_UPGRADE_FILL_COLOR;
  }
  const base = hexToRgb(fillColor);
  const t = (clamped - 1) / (MAX_UNIT_LEVEL - 1);
  if (t <= 0.2) {
    const local = t / 0.2;
    return rgbToHex(
      lerp(base.r, WARM_RED.r, local),
      lerp(base.g, WARM_RED.g, local),
      lerp(base.b, WARM_RED.b, local),
    );
  }
  const hue = ((t - 0.2) / 0.8) * 300;
  return hslToHex(hue, 0.85, 0.55);
}

function resolveHueShiftFillColor(fillColor: string, level: number): string {
  const { r, g, b } = hexToRgb(fillColor);
  const { h, s, l } = rgbToHsl(r, g, b);
  const steps = Math.min(MAX_UNIT_LEVEL, Math.max(1, level)) - 1;
  const hue = (h + steps * 90) % 360;
  return hslToHex(hue, Math.max(0.2, s), Math.max(0.15, Math.min(0.85, l)));
}

function resolveLightenFillColor(fillColor: string, level: number): string {
  const { r, g, b } = hexToRgb(fillColor);
  const { h, s, l } = rgbToHsl(r, g, b);
  const steps = Math.min(MAX_UNIT_LEVEL, Math.max(1, level)) - 1;
  const lightness = Math.min(0.9, l + steps * 0.12);
  return hslToHex(h, s, lightness);
}

function resolveSaturateFillColor(fillColor: string, level: number): string {
  const { r, g, b } = hexToRgb(fillColor);
  const { h, s, l } = rgbToHsl(r, g, b);
  const steps = Math.min(MAX_UNIT_LEVEL, Math.max(1, level)) - 1;
  const saturation = Math.min(1, s + steps * 0.15);
  return hslToHex(h, saturation, l);
}

export function resolveUnitFillColor(appearance: Partial<UnitAppearance> | undefined, level: number): string {
  const { fillColor, upgradeColorMod } = normalizeUnitAppearance(appearance);
  switch (upgradeColorMod) {
    case 'hue_shift':
      return resolveHueShiftFillColor(fillColor, level);
    case 'lighten':
      return resolveLightenFillColor(fillColor, level);
    case 'saturate':
      return resolveSaturateFillColor(fillColor, level);
    case 'spectrum':
    default:
      return resolveSpectrumFillColor(fillColor, level);
  }
}

export function getUnitVisualScale(level: number): number {
  const upgrades = Math.min(3, Math.max(0, Math.min(MAX_UNIT_LEVEL, level) - 1));
  return 1 + upgrades * 0.18;
}

export function getUpgradeFillColor(level: number): string {
  return resolveUnitFillColor(
    { fillColor: DEFAULT_FILL_COLOR, upgradeColorMod: DEFAULT_UPGRADE_COLOR_MOD },
    level,
  );
}

export function getHealthBorderColor(hpRatio: number): string {
  const ratio = Math.max(0, Math.min(1, hpRatio));
  if (ratio <= 0.1) {
    return '#ff0000';
  }
  if (ratio <= 0.2) {
    const t = (ratio - 0.1) / 0.1;
    return `#${lerp(255, 255, t).toString(16).padStart(2, '0')}${lerp(0, 165, t).toString(16).padStart(2, '0')}00`;
  }
  if (ratio <= 0.5) {
    const t = (ratio - 0.2) / 0.3;
    return `#${lerp(255, 255, t).toString(16).padStart(2, '0')}${lerp(165, 255, t).toString(16).padStart(2, '0')}00`;
  }
  const t = (ratio - 0.5) / 0.5;
  return `#${lerp(255, 34, t).toString(16).padStart(2, '0')}${lerp(255, 197, t).toString(16).padStart(2, '0')}${lerp(0, 94, t).toString(16).padStart(2, '0')}`;
}

export function isCriticalHealth(hpRatio: number): boolean {
  return hpRatio <= 0.1;
}

export function ngonPoints(
  sides: number,
  cx: number,
  cy: number,
  radius: number,
  rotation = -Math.PI / 2,
): string {
  const count = Math.max(3, sides);
  const points: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rotation + (i * 2 * Math.PI) / count;
    points.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
  }
  return points.join(' ');
}
