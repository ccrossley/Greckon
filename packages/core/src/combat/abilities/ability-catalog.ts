import type { UnitType } from '../../types/domain.js';
import { ABILITY_CATALOG, type Ability, type AbilityId } from '../../generated/abilities.js';
import { UNIT_CATALOG } from '../../generated/units.js';

export type { Ability, AbilityId } from '../../generated/abilities.js';

export function getAbility(abilityId: AbilityId): Ability {
  const ability = ABILITY_CATALOG[abilityId];
  if (!ability) {
    throw new Error(`Unknown ability: ${abilityId}`);
  }
  return ability;
}

export function getAbilityForUnit(unitType: UnitType): Ability {
  const unit = UNIT_CATALOG[unitType];
  if (!unit) {
    throw new Error(`Unknown unit type: ${unitType}`);
  }
  return getAbility(unit.abilityId);
}

export function listAbilities(): readonly Ability[] {
  return Object.values(ABILITY_CATALOG);
}

export function formatAbilityEffectsSummary(ability: Ability): string {
  return ability.effects.map((effect) => effect.kind).join(', ');
}
