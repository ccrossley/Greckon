import type { CombatUnit, StatusEffect } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';

export function ensureStatusEffects(unit: CombatUnit): StatusEffect[] {
  if (!unit.statusEffects) {
    unit.statusEffects = [];
  }
  return unit.statusEffects;
}

export function addStatusEffect(unit: CombatUnit, effect: StatusEffect): void {
  ensureStatusEffects(unit).push(effect);
}

export function getEffectiveDefense(unit: CombatUnit, atMs: number): number {
  let defense = unit.defense;
  for (const effect of unit.statusEffects ?? []) {
    if (effect.expiresAtMs <= atMs) {
      continue;
    }
    if (effect.kind === 'defense_buff' || effect.kind === 'self_shield' || effect.kind === 'ally_shield') {
      defense += effect.magnitude;
    }
  }
  return defense;
}

export function getEffectiveSpeed(unit: CombatUnit, atMs: number): number {
  let speed = unit.speed;
  for (const effect of unit.statusEffects ?? []) {
    if (effect.expiresAtMs <= atMs) {
      continue;
    }
    if (effect.kind === 'slow') {
      speed = Math.max(1, speed - effect.magnitude);
    }
  }
  return speed;
}

export function tickStatusEffects(
  units: CombatUnit[],
  atMs: number,
  onDotDamage?: (sourceUnitId: string | undefined, target: CombatUnit, damage: number) => void,
): void {
  const stepMs = getCombatTuning().simulation.stepMs;
  for (const unit of units) {
    if (unit.hp <= 0 || !unit.statusEffects?.length) {
      continue;
    }
    const remaining: StatusEffect[] = [];
    for (const effect of unit.statusEffects) {
      if (effect.expiresAtMs <= atMs) {
        continue;
      }
      if (effect.kind === 'spore_dot' && onDotDamage) {
        const dotDamage = Math.max(1, Math.round(effect.magnitude * (stepMs / 1000)));
        onDotDamage(effect.sourceUnitId, unit, dotDamage);
      }
      remaining.push(effect);
    }
    unit.statusEffects = remaining;
  }
}

export function clearExpiredStatusEffects(units: CombatUnit[], atMs: number): void {
  for (const unit of units) {
    if (!unit.statusEffects?.length) {
      continue;
    }
    unit.statusEffects = unit.statusEffects.filter((effect) => effect.expiresAtMs > atMs);
  }
}
