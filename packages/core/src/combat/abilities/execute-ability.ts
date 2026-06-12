import type { Ability } from '../../generated/abilities.js';
import type { CombatUnit, PlaybackEvent } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { computeAttackDamage, getMaxDamagePerTick, getUnitDisplayName } from '../../game-data/index.js';
import { applyKnockback } from '../physics/forces.js';
import type { PhysicsWorld } from '../physics/world.js';
import { getAbilityForUnit } from './ability-catalog.js';
import { addStatusEffect, getEffectiveDefense } from './status-effects.js';

export interface PendingAbilityAttack {
  landAtMs: number;
  attacker: CombatUnit;
  targetId: string;
  damage: number;
}

export interface AbilityExecutionContext {
  atMs: number;
  playback: PlaybackEvent[];
  pending: PendingAbilityAttack[];
  damageAppliedThisTick: Map<string, number>;
  lastAttackMs: Map<string, number>;
  world: PhysicsWorld;
  chargeDamageScale?: number;
}

function attackLineFlashMs(): number {
  return getCombatTuning().playback.attackLineFlashMs;
}

function cappedDamage(
  rawDamage: number,
  target: CombatUnit,
  damageAppliedThisTick: Map<string, number>,
): number {
  const tickCap = getMaxDamagePerTick(target.maxHp);
  const alreadyApplied = damageAppliedThisTick.get(target.unitId) ?? 0;
  return Math.min(rawDamage, Math.max(0, tickCap - alreadyApplied));
}

function applyDamage(
  target: CombatUnit,
  damage: number,
  damageAppliedThisTick: Map<string, number>,
): void {
  damageAppliedThisTick.set(target.unitId, (damageAppliedThisTick.get(target.unitId) ?? 0) + damage);
  target.hp = Math.max(0, target.hp - damage);
}

function pushDeathEvent(
  playback: PlaybackEvent[],
  atMs: number,
  target: CombatUnit,
  world: PhysicsWorld,
): void {
  playback.push({
    atMs: atMs + 1,
    kind: 'death',
    description: `${getUnitDisplayName(target.unitType)} defeated`,
    sourceUnitId: target.unitId,
    x: target.x,
    y: target.y,
    height: world.getWorldHeight(target.unitId, atMs, target.movementType),
  });
}

function pushHealEvent(
  ctx: AbilityExecutionContext,
  attacker: CombatUnit,
  target: CombatUnit,
  amount: number,
  ability: Ability,
): void {
  ctx.playback.push({
    atMs: ctx.atMs,
    kind: 'heal',
    description: `${ability.name} heals ${getUnitDisplayName(target.unitType)} for ${amount}`,
    sourceUnitId: attacker.unitId,
    targetUnitId: target.unitId,
    x: attacker.x,
    y: attacker.y,
    x2: target.x,
    y2: target.y,
    height: ctx.world.getWorldHeight(attacker.unitId, ctx.atMs, attacker.movementType),
    healAmount: amount,
    attackType: attacker.attackType,
    playbackColor: ability.playback.color,
    playbackBeam: ability.playback.beam,
    durationMs: attackLineFlashMs(),
  });
}

function pushAttackEvent(
  ctx: AbilityExecutionContext,
  attacker: CombatUnit,
  target: CombatUnit,
  damage: number,
  ability: Ability,
  options?: { durationMs?: number; travelTimeMs?: number },
): void {
  ctx.playback.push({
    atMs: ctx.atMs,
    kind: 'attack',
    description: `${ability.name} hits ${getUnitDisplayName(target.unitType)} for ${damage}`,
    sourceUnitId: attacker.unitId,
    targetUnitId: target.unitId,
    x: attacker.x,
    y: attacker.y,
    x2: target.x,
    y2: target.y,
    height: ctx.world.getWorldHeight(attacker.unitId, ctx.atMs, attacker.movementType),
    attackType: attacker.attackType,
    travelTimeMs: options?.travelTimeMs ?? attacker.travelTimeMs,
    damage,
    durationMs: options?.durationMs,
    playbackColor: ability.playback.color,
    playbackBeam: ability.playback.beam,
  });
}

function computeBaseDamage(
  attacker: CombatUnit,
  target: CombatUnit,
  atMs: number,
  ability: Ability,
  chargeDamageScale?: number,
): number {
  let defense = getEffectiveDefense(target, atMs);
  const pierce = ability.effects.find((effect) => effect.kind === 'pierce');
  if (pierce?.fraction) {
    defense = Math.round(defense * (1 - pierce.fraction));
  }
  let damage = attacker.damage ?? computeAttackDamage(attacker.attack, defense);

  const frenzy = ability.effects.find((effect) => effect.kind === 'frenzy');
  if (frenzy?.scale) {
    const missingRatio = 1 - attacker.hp / attacker.maxHp;
    damage = Math.round(damage * (1 + missingRatio * frenzy.scale));
  }

  const execute = ability.effects.find((effect) => effect.kind === 'execute');
  if (execute?.threshold !== undefined && target.hp / target.maxHp <= execute.threshold) {
    damage = Math.round(damage * (1 + (execute.scale ?? 0.5)));
  }

  if (chargeDamageScale) {
    damage = Math.ceil(damage * chargeDamageScale);
  }

  return Math.max(1, damage);
}

function applyHealToTarget(
  ctx: AbilityExecutionContext,
  attacker: CombatUnit,
  target: CombatUnit,
  ability: Ability,
): void {
  const healEffect = ability.effects.find((effect) => effect.kind === 'heal');
  if (!healEffect) {
    return;
  }
  const scale = healEffect.scale ?? 1;
  const amount = Math.max(1, Math.round(attacker.attack * scale * 0.5));
  const healed = Math.min(amount, target.maxHp - target.hp);
  if (healed <= 0) {
    return;
  }
  target.hp += healed;
  pushHealEvent(ctx, attacker, target, healed, ability);

  const lifesteal = ability.effects.find((effect) => effect.kind === 'lifesteal');
  if (lifesteal?.fraction) {
    const selfHeal = Math.max(1, Math.round(healed * lifesteal.fraction));
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + selfHeal);
  }

  const shield = ability.effects.find((effect) => effect.kind === 'ally_shield');
  if (shield?.amount && shield.durationMs) {
    addStatusEffect(target, {
      kind: 'ally_shield',
      expiresAtMs: ctx.atMs + shield.durationMs,
      magnitude: shield.amount,
    });
  }
}

function applyPostDamageEffects(
  ctx: AbilityExecutionContext,
  attacker: CombatUnit,
  target: CombatUnit,
  damage: number,
  ability: Ability,
): void {
  const lifesteal = ability.effects.find((effect) => effect.kind === 'lifesteal');
  if (lifesteal?.fraction && damage > 0) {
    const healed = Math.max(1, Math.round(damage * lifesteal.fraction));
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + healed);
  }

  const slow = ability.effects.find((effect) => effect.kind === 'slow');
  if (slow?.amount && slow.durationMs) {
    addStatusEffect(target, {
      kind: 'slow',
      expiresAtMs: ctx.atMs + slow.durationMs,
      magnitude: slow.amount,
    });
  }

  const dot = ability.effects.find((effect) => effect.kind === 'spore_dot');
  if (dot?.durationMs) {
    addStatusEffect(target, {
      kind: 'spore_dot',
      expiresAtMs: ctx.atMs + dot.durationMs,
      magnitude: dot.scale ?? 0.4,
      sourceUnitId: attacker.unitId,
    });
  }

  const knockback = ability.effects.find((effect) => effect.kind === 'knockback');
  if (knockback?.strength) {
    applyKnockback(ctx.world, attacker, target, knockback.strength);
  }

  const selfShield = ability.effects.find((effect) => effect.kind === 'self_shield');
  if (selfShield?.amount && selfShield.durationMs) {
    addStatusEffect(attacker, {
      kind: 'self_shield',
      expiresAtMs: ctx.atMs + selfShield.durationMs,
      magnitude: selfShield.amount,
    });
  }
}

function deliverDamage(
  ctx: AbilityExecutionContext,
  attacker: CombatUnit,
  target: CombatUnit,
  rawDamage: number,
  ability: Ability,
): void {
  const damage = cappedDamage(rawDamage, target, ctx.damageAppliedThisTick);
  if (damage <= 0) {
    return;
  }

  if (attacker.attackType === 'projectile') {
    pushAttackEvent(ctx, attacker, target, damage, ability, {
      durationMs: attacker.travelTimeMs,
      travelTimeMs: attacker.travelTimeMs,
    });
    ctx.pending.push({
      landAtMs: ctx.atMs + attacker.travelTimeMs,
      attacker: { ...attacker },
      targetId: target.unitId,
      damage: rawDamage,
    });
    return;
  }

  applyDamage(target, damage, ctx.damageAppliedThisTick);
  pushAttackEvent(ctx, attacker, target, damage, ability, {
    durationMs:
      attacker.attackType === 'line' || attacker.attackType === 'multi'
        ? attackLineFlashMs()
        : 0,
  });
  applyPostDamageEffects(ctx, attacker, target, damage, ability);
  if (target.hp <= 0) {
    pushDeathEvent(ctx.playback, ctx.atMs, target, ctx.world);
    ctx.world.removeUnit(target.unitId);
  }
}

function hasDamageEffect(ability: Ability): boolean {
  return ability.effects.some((effect) => effect.kind === 'damage');
}

function hasHealEffect(ability: Ability): boolean {
  return ability.effects.some((effect) => effect.kind === 'heal');
}

export function executeAbility(
  attacker: CombatUnit,
  targets: CombatUnit[],
  ctx: AbilityExecutionContext,
): void {
  if (targets.length === 0) {
    return;
  }

  const ability = getAbilityForUnit(attacker.unitType);
  ctx.lastAttackMs.set(attacker.unitId, ctx.atMs);

  if (hasHealEffect(ability) && !hasDamageEffect(ability)) {
    for (const target of targets) {
      if (target.hp > 0) {
        applyHealToTarget(ctx, attacker, target, ability);
      }
    }
    return;
  }

  const cleave = ability.effects.find((effect) => effect.kind === 'cleave');
  const cleaveScale = cleave?.scale ?? 0.6;

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]!;
    if (target.hp <= 0) {
      continue;
    }
    let rawDamage = computeBaseDamage(attacker, target, ctx.atMs, ability, ctx.chargeDamageScale);
    if (index > 0 && cleave) {
      rawDamage = Math.max(1, Math.round(rawDamage * cleaveScale));
    }
    const damageScale = ability.effects.find((effect) => effect.kind === 'damage')?.scale ?? 1;
    rawDamage = Math.max(1, Math.round(rawDamage * damageScale));
    deliverDamage(ctx, attacker, target, rawDamage, ability);
  }
}

export function landPendingAbilityAttack(
  attack: PendingAbilityAttack,
  target: CombatUnit,
  ctx: AbilityExecutionContext,
): void {
  const ability = getAbilityForUnit(attack.attacker.unitType);
  const damage = cappedDamage(attack.damage, target, ctx.damageAppliedThisTick);
  if (damage <= 0) {
    return;
  }
  applyDamage(target, damage, ctx.damageAppliedThisTick);
  pushAttackEvent(ctx, attack.attacker, target, damage, ability, {
    durationMs: 0,
    travelTimeMs: attack.attacker.travelTimeMs,
  });
  applyPostDamageEffects(ctx, attack.attacker, target, damage, ability);
  if (target.hp <= 0) {
    pushDeathEvent(ctx.playback, ctx.atMs, target, ctx.world);
    ctx.world.removeUnit(target.unitId);
  }
}
