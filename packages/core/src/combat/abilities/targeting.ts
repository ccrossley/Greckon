import type { Ability } from '../../generated/abilities.js';
import type { CombatUnit } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { findEnemiesInRange, findEnemyInRange, horizontalDistanceUnits } from '../physics/forces.js';

function effectiveRange(unit: CombatUnit, ability: Ability): number {
  const bonus = 'rangeBonus' in ability && typeof ability.rangeBonus === 'number' ? ability.rangeBonus : 0;
  return unit.attackRange + bonus;
}

function alliesInRange(unit: CombatUnit, units: CombatUnit[], range: number): CombatUnit[] {
  const scale = getCombatTuning().physics.fieldScale;
  const rangeM = range * scale;
  return units
    .filter(
      (other) =>
        other.playerId === unit.playerId &&
        other.unitId !== unit.unitId &&
        other.hp > 0 &&
        horizontalDistanceUnits(unit, other) <= rangeM,
    )
    .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp);
}

function woundedAlliesInRange(unit: CombatUnit, units: CombatUnit[], range: number): CombatUnit[] {
  return alliesInRange(unit, units, range).filter((ally) => ally.hp < ally.maxHp);
}

function preferWoundedEnemy(unit: CombatUnit, units: CombatUnit[], range: number): CombatUnit | null {
  const enemies = findEnemiesInRange(unit, units, range);
  if (enemies.length === 0) {
    return null;
  }
  const wounded = enemies.filter((enemy) => enemy.hp < enemy.maxHp);
  if (wounded.length > 0) {
    return wounded.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0]!;
  }
  return enemies[0]!;
}

function adjacentEnemies(primary: CombatUnit, unit: CombatUnit, units: CombatUnit[], range: number): CombatUnit[] {
  const scale = getCombatTuning().physics.fieldScale;
  const rangeM = range * scale * 1.35;
  const enemies = findEnemiesInRange(unit, units, range);
  if (enemies.length === 0) {
    return [];
  }
  const primaryTarget = primary;
  const adjacent = enemies.filter(
    (enemy) =>
      enemy.unitId !== primaryTarget.unitId &&
      horizontalDistanceUnits(primaryTarget, enemy) <= rangeM,
  );
  return [primaryTarget, ...adjacent];
}

export function isSupportAbility(ability: Ability): boolean {
  return ability.targeting === 'lowest_hp_ally_in_range';
}

export function resolveAbilityTargets(
  unit: CombatUnit,
  ability: Ability,
  units: CombatUnit[],
): CombatUnit[] {
  const range = effectiveRange(unit, ability);
  const alive = units.filter((candidate) => candidate.hp > 0);

  switch (ability.targeting) {
    case 'lowest_hp_ally_in_range': {
      const wounded = woundedAlliesInRange(unit, alive, range);
      if (wounded.length > 0) {
        return [wounded[0]!];
      }
      const allies = alliesInRange(unit, alive, range);
      if (allies.length > 0 && allies[0]!.hp < allies[0]!.maxHp) {
        return [allies[0]!];
      }
      return [];
    }
    case 'all_enemies_in_range':
      return findEnemiesInRange(unit, alive, range);
    case 'volley_enemies': {
      const count =
        'volleyCount' in ability && typeof ability.volleyCount === 'number' ? ability.volleyCount : 2;
      return findEnemiesInRange(unit, alive, range).slice(0, count);
    }
    case 'nearest_enemy_in_range_prefer_wounded': {
      const enemy = preferWoundedEnemy(unit, alive, range);
      return enemy ? [enemy] : [];
    }
    case 'primary_plus_adjacent_enemies': {
      const primary = findEnemyInRange(unit, alive, range);
      if (!primary) {
        return [];
      }
      return adjacentEnemies(primary, unit, alive, range);
    }
    case 'nearest_enemy_in_range':
    default: {
      const enemy = findEnemyInRange(unit, alive, range);
      return enemy ? [enemy] : [];
    }
  }
}
