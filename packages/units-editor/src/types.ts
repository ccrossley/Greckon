import type { Unit } from '@greckon/services/units';

export type { Unit };
export type EditorUnit = Unit;

export type UpgradeColorMod = NonNullable<Unit['upgradeColorMod']>;
export type AttackType = Unit['attackType'];
export type MovementType = Unit['movementType'];
export type StatKey = 'maxHp' | 'attack' | 'defense' | 'speed';
export type EditorTab = 'appearance' | 'stats' | 'playground';

export const STAT_KEYS: StatKey[] = ['maxHp', 'attack', 'defense', 'speed'];

export const STAT_LABELS: Record<StatKey, string> = {
  maxHp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  speed: 'Speed',
};
