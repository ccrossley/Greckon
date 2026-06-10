import type { CombatUnit, PlayerId, UnitType } from '../types/domain.js';
import { getUnitRowPriority } from '../game-data/combat-stats.js';
import { getUnitVisualScale, MAX_UNIT_LEVEL, UNIT_VISUAL_RADIUS } from './visual.js';

export const UNIT_DIAMETER = 0.00625;

export const FIELD_X_MIN = 0.05;
export const FIELD_X_MAX = 0.95;

/** Normalized body radius on the 0–1 field (matches arena visuals). */
export function getUnitBodyRadius(level = 1): number {
  return (UNIT_VISUAL_RADIUS * getUnitVisualScale(level)) / 100;
}

/** Minimum center-to-center distance between two units. */
export function getMinUnitGap(levelA = 1, levelB = 1): number {
  return getUnitBodyRadius(levelA) + getUnitBodyRadius(levelB) + 0.012;
}

const MAX_BODY_RADIUS = getUnitBodyRadius(MAX_UNIT_LEVEL);
export const ROW_Y_SPACING = MAX_BODY_RADIUS * 2 + 0.014;
/** Horizontal spacing in normalized field coordinates (decoupled from sim diameter). */
export const UNIT_X_SPACING = MAX_BODY_RADIUS * 2 + 0.016;
/** @deprecated use getMinUnitGap() */
export const MIN_UNIT_GAP = getMinUnitGap(1, 1);
/** Normalized field distance at which melee units can strike. */
export const MELEE_ATTACK_RANGE = 0.055;
/** Normalized field distance at which ranged units can strike. */
export const RANGED_ATTACK_RANGE = 0.16;

export function getAttackRange(unit: Pick<CombatUnit, 'attackRange'>): number {
  return unit.attackRange;
}

export function isMeleeUnit(unit: Pick<CombatUnit, 'attackRange'>): boolean {
  return unit.attackRange <= MELEE_ATTACK_RANGE + 0.001;
}

export function isRangedUnit(unit: Pick<CombatUnit, 'attackRange'>): boolean {
  return !isMeleeUnit(unit);
}

export const PLAYER_BACK_Y = 0.88;
export const ENEMY_BACK_Y = 0.12;

export function getUnitCombatPower(unit: CombatUnit): number {
  return unit.attack + unit.defense + unit.maxHp + unit.level * 12;
}

function compareUnitsForFormation(left: CombatUnit, right: CombatUnit): number {
  const powerDiff = getUnitCombatPower(right) - getUnitCombatPower(left);
  if (powerDiff !== 0) {
    return powerDiff;
  }
  return left.unitId.localeCompare(right.unitId);
}

export function rowXPositionsForUnits(units: CombatUnit[], centerX = 0.5): number[] {
  if (units.length === 0) {
    return [];
  }
  if (units.length === 1) {
    return [centerX];
  }

  const gaps: number[] = [];
  for (let index = 1; index < units.length; index++) {
    gaps.push(getMinUnitGap(units[index - 1]!.level, units[index]!.level));
  }
  const span = gaps.reduce((total, gap) => total + gap, 0);
  let x = centerX - span / 2;
  const positions = [x];
  for (const gap of gaps) {
    x += gap;
    positions.push(x);
  }
  return positions;
}

export function rowFitsInField(units: CombatUnit[]): boolean {
  if (units.length === 0) {
    return true;
  }
  const xs = rowXPositionsForUnits(units);
  const leftEdge = xs[0]! - getUnitBodyRadius(units[0]!.level);
  const rightEdge = xs[xs.length - 1]! + getUnitBodyRadius(units[units.length - 1]!.level);
  return leftEdge >= FIELD_X_MIN && rightEdge <= FIELD_X_MAX;
}

export function chunkUnitsIntoRows(units: CombatUnit[]): CombatUnit[][] {
  if (units.length === 0) {
    return [];
  }

  const sorted = [...units].sort(compareUnitsForFormation);
  const rows: CombatUnit[][] = [];
  let index = 0;

  while (index < sorted.length) {
    let count = 1;
    while (index + count < sorted.length && rowFitsInField(sorted.slice(index, index + count + 1))) {
      count++;
    }
    while (count > 1 && !rowFitsInField(sorted.slice(index, index + count))) {
      count--;
    }
    rows.push(sorted.slice(index, index + count));
    index += count;
  }

  return rows;
}

/** @deprecated use rowXPositionsForUnits() */
export function rowXPositions(count: number, centerX = 0.5): number[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [centerX];
  }
  const span = (count - 1) * UNIT_X_SPACING;
  const left = centerX - span / 2;
  return Array.from({ length: count }, (_, index) => left + index * UNIT_X_SPACING);
}

function groupUnitsByType(units: CombatUnit[]): Array<[UnitType, CombatUnit[]]> {
  const byType = new Map<UnitType, CombatUnit[]>();
  for (const unit of units) {
    const group = byType.get(unit.unitType) ?? [];
    group.push(unit);
    byType.set(unit.unitType, group);
  }
  return [...byType.entries()].sort(
    (left, right) => getUnitRowPriority(left[0]) - getUnitRowPriority(right[0]),
  );
}

export function layoutPlayerFormation(
  units: CombatUnit[],
  playerId: PlayerId,
  isBottom = true,
): void {
  const roster = units.filter((unit) => unit.playerId === playerId);
  if (roster.length === 0) {
    return;
  }

  const baseY = isBottom ? PLAYER_BACK_Y : ENEMY_BACK_Y;
  const typeGroups = groupUnitsByType(roster);
  const rows: CombatUnit[][] = [];

  for (const [, group] of typeGroups) {
    rows.push(...chunkUnitsIntoRows([...group].sort(compareUnitsForFormation)));
  }

  rows.forEach((rowUnits, rowIndex) => {
    const depthFromBack = rows.length - 1 - rowIndex;
    const rowY = isBottom
      ? baseY - depthFromBack * ROW_Y_SPACING
      : baseY + depthFromBack * ROW_Y_SPACING;
    const orderedRow = [...rowUnits].sort(compareUnitsForFormation);
    const xs = rowXPositionsForUnits(orderedRow);
    orderedRow.forEach((unit, index) => {
      unit.x = xs[index] ?? 0.5;
      unit.y = rowY;
    });
  });
}

export function layoutAllFormations(
  units: CombatUnit[],
  playerAId: PlayerId,
  playerBId: PlayerId,
): void {
  layoutPlayerFormation(units, playerAId, true);
  layoutPlayerFormation(units, playerBId, false);
}
