import type { CombatUnit, PlayerId, UnitType } from '../types/domain.js';
import type { ActionDefinition } from '../types/domain.js';
import { getUnitDefinition, getUnitDisplayName, getFactionIdForUnit, listUnitTypes, listUnitTypesForFaction } from './unit-catalog.js';
import {
  getUnitIndex,
  getUnitRowPriority,
  scaleStatsForLevel,
  unitTypeFromIndex,
} from './combat-stats.js';

export function getActionsForUnit(unitType: UnitType, alive: boolean): ActionDefinition[] {
  const unit = getUnitDefinition(unitType);
  return unit.actions.filter((action) => !action.requiresAlive || alive);
}

export { getUnitDefinition, getUnitDisplayName, getFactionIdForUnit, listUnitTypes, listUnitTypesForFaction };

export {
  getFaction,
  getFactionDisplayName,
  isValidFactionId,
  listFactionIds,
  listFactions,
} from './faction-catalog.js';
export type { Faction, FactionId } from './faction-catalog.js';

export function createCombatUnit(
  unitId: string,
  unitType: UnitType,
  playerId: PlayerId,
  x: number,
  y: number,
  level = 1,
): CombatUnit {
  const definition = getUnitDefinition(unitType);
  const scaled = scaleStatsForLevel(
    {
      maxHp: definition.maxHp,
      attack: definition.attack,
      defense: definition.defense,
      speed: definition.speed,
    },
    level,
  );

  return {
    unitId,
    unitType,
    playerId,
    hp: scaled.maxHp,
    maxHp: scaled.maxHp,
    level,
    priority: getUnitRowPriority(unitType),
    x,
    y,
    attack: scaled.attack,
    defense: scaled.defense,
    speed: scaled.speed,
    ngonSides: definition.ngonSides,
    attackRange: definition.attackRange,
    attackType: definition.attackType,
    attackDelayMs: definition.attackDelayMs,
    travelTimeMs: definition.travelTimeMs,
    movementType: definition.movementType,
    damage: definition.damage,
    statusEffects: [],
  };
}

export {
  computeAttackDamage,
  generateBaseStats,
  getAttackCooldownMs,
  getMaxDamagePerTick,
  getStatBudget,
  getTurnUnitTypes,
  getUnitIndex,
  getUnitRowPriority,
  scaleStatsForLevel,
  unitTypeFromIndex,
} from './combat-stats.js';
export type { UnitCombatStats } from './combat-stats.js';
