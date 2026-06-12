export {
  formatAbilityEffectsSummary,
  getAbility,
  getAbilityForUnit,
  listAbilities,
} from './ability-catalog.js';
export type { Ability, AbilityId } from './ability-catalog.js';

export { resolveAbilityTargets, isSupportAbility } from './targeting.js';

export {
  addStatusEffect,
  clearExpiredStatusEffects,
  ensureStatusEffects,
  getEffectiveDefense,
  getEffectiveSpeed,
  tickStatusEffects,
} from './status-effects.js';

export {
  executeAbility,
  landPendingAbilityAttack,
  type AbilityExecutionContext,
  type PendingAbilityAttack,
} from './execute-ability.js';
