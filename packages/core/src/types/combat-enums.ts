export type AttackType = 'line' | 'projectile' | 'instant' | 'multi';
export type MovementType = 'float' | 'hop' | 'charge';
export type UpgradeColorMod = 'spectrum' | 'hue_shift' | 'lighten' | 'saturate';

export type { UnitType } from '../generated/units.js';

export const MELEE_ATTACK_RANGE = 0.055;
export const RANGED_ATTACK_RANGE = 0.16;
