import type { UnitDefinition, UnitType, UpgradeColorMod } from '../types/domain.js';
import { UNITS, UNIT_CATALOG, type Unit } from '../generated/units.js';

function toUnitDefinition(unit: Unit): UnitDefinition {
  const definition: UnitDefinition = {
    unitType: unit.id,
    name: unit.name,
    maxHp: unit.maxHp,
    ngonSides: unit.sides,
    attack: unit.attack,
    defense: unit.defense,
    speed: unit.speed,
    attackRange: unit.attackRange,
    addAmount: unit.addAmount,
    attackType: unit.attackType,
    attackDelayMs: unit.attackDelayMs,
    travelTimeMs: unit.travelTimeMs,
    movementType: unit.movementType,
    icon: unit.icon,
    actions: [],
  };
  if ('damage' in unit && typeof unit.damage === 'number') {
    definition.damage = unit.damage;
  }
  if ('fillColor' in unit && typeof unit.fillColor === 'string') {
    definition.fillColor = unit.fillColor;
  }
  if ('upgradeColorMod' in unit && typeof unit.upgradeColorMod === 'string') {
    definition.upgradeColorMod = unit.upgradeColorMod as UpgradeColorMod;
  }
  return definition;
}

const catalog: Record<UnitType, UnitDefinition> = Object.fromEntries(
  Object.values(UNIT_CATALOG).map((unit) => [unit.id, toUnitDefinition(unit)]),
) as Record<UnitType, UnitDefinition>;

export function getUnitDefinition(unitType: UnitType): UnitDefinition {
  const unit = catalog[unitType];
  if (!unit) {
    throw new Error(`Unknown unit type: ${unitType}`);
  }
  return unit;
}

export function getUnitDisplayName(unitType: UnitType): string {
  return getUnitDefinition(unitType).name;
}

export function listUnitTypes(): UnitType[] {
  return UNITS.map((unit) => unit.id);
}
