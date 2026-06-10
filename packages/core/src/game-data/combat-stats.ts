import { UNITS, type UnitType } from '../generated/units.js';

export interface UnitCombatStats {
  attack: number;
  defense: number;
  maxHp: number;
  speed: number;
}

export function unitTypeFromIndex(index: number): UnitType {
  const unit = UNITS[index - 1];
  if (!unit) {
    throw new Error(`Unit index out of range: ${index}`);
  }
  return unit.id;
}

export function getUnitIndex(unitType: UnitType): number {
  const index = UNITS.findIndex((unit) => unit.id === unitType);
  if (index < 0) {
    throw new Error(`Invalid unit type: ${unitType}`);
  }
  return index + 1;
}

export function getStatBudget(index: number): number {
  return 20 + index * 8;
}

/** @deprecated use unit catalog JSON; kept for migration tests */
export function generateBaseStats(index: number): UnitCombatStats & { ngonSides: number; isRanged: boolean; range: number } {
  const statBudget = getStatBudget(index);
  const isRanged = index % 2 === 1;

  if (isRanged) {
    return {
      ngonSides: index + 2,
      isRanged: true,
      attack: Math.max(1, Math.round(statBudget * 0.2)),
      defense: Math.max(1, Math.round(statBudget * 0.15)),
      maxHp: Math.max(1, Math.round(statBudget * 0.3)),
      speed: Math.max(1, Math.round(statBudget * 0.15)),
      range: 5,
    };
  }

  return {
    ngonSides: index + 2,
    isRanged: false,
    attack: Math.max(1, Math.round(statBudget * 0.35)),
    defense: Math.max(1, Math.round(statBudget * 0.3)),
    maxHp: Math.max(1, Math.round(statBudget * 0.32)),
    speed: Math.max(1, Math.round(statBudget * 0.1)),
    range: 1,
  };
}

/** Softens raw stat delta so units trade blows over several seconds. */
export function computeAttackDamage(attack: number, defense: number): number {
  const mitigated = attack - defense * 0.65;
  return Math.max(1, Math.round(mitigated * 0.08));
}

/** Faster units attack more often; all units wait at least one playback beat. */
export function getAttackCooldownMs(speed: number): number {
  return Math.max(500, 1000 - speed * 20);
}

/** Limits burst focus fire so multiple attackers still wear targets down gradually. */
export function getMaxDamagePerTick(maxHp: number): number {
  return Math.max(1, Math.round(maxHp * 0.35));
}

export function scaleStatsForLevel(
  stats: UnitCombatStats,
  level: number,
): UnitCombatStats {
  const multiplier = 1 + (Math.min(6, Math.max(1, level)) - 1) * 0.1;
  return {
    attack: Math.max(1, Math.round(stats.attack * multiplier)),
    defense: Math.max(1, Math.round(stats.defense * multiplier)),
    maxHp: Math.max(1, Math.round(stats.maxHp * multiplier)),
    speed: Math.max(1, Math.round(stats.speed * multiplier)),
  };
}

export function getUnitRowPriority(unitType: UnitType): number {
  const index = getUnitIndex(unitType);
  const isRanged = index % 2 === 1;
  return (isRanged ? 1000 : 0) + (UNITS.length - index);
}

export function getTurnUnitTypes(turnIndex: number, count = 4): UnitType[] {
  const types: UnitType[] = [];
  const poolSize = UNITS.length;
  for (let offset = 0; types.length < count; offset++) {
    const index = ((turnIndex * 3 + offset) % poolSize) + 1;
    const unitType = unitTypeFromIndex(index);
    if (!types.includes(unitType)) {
      types.push(unitType);
    }
  }
  return types;
}
