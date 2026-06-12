import type { CombatUnit, PlaybackEvent, PlayerId } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { getUnitDisplayName } from '../../game-data/index.js';
import {
  executeAbility,
  getAbilityForUnit,
  landPendingAbilityAttack,
  resolveAbilityTargets,
  tickStatusEffects,
  type AbilityExecutionContext,
  type PendingAbilityAttack,
} from '../abilities/index.js';
import {
  decayChargeWhenHolding,
  getChargeImpactReady,
  resetChargeAfterImpact,
} from './forces.js';
import {
  applyTerrestrialCombatStep,
  createTerrestrialMovementState,
} from './terrestrial-locomotion.js';
import { createPhysicsWorld, type PhysicsWorld } from './world.js';

function pushDeathEvent(playback: PlaybackEvent[], atMs: number, target: CombatUnit, world: PhysicsWorld): void {
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

function processPendingAttacks(
  atMs: number,
  pending: PendingAbilityAttack[],
  units: CombatUnit[],
  ctx: AbilityExecutionContext,
): void {
  const unitsById = new Map(units.map((unit) => [unit.unitId, unit]));
  for (let index = pending.length - 1; index >= 0; index--) {
    const attack = pending[index]!;
    if (attack.landAtMs > atMs) {
      continue;
    }
    const target = unitsById.get(attack.targetId);
    if (!target || target.hp <= 0) {
      pending.splice(index, 1);
      continue;
    }
    landPendingAbilityAttack(attack, target, ctx);
    pending.splice(index, 1);
  }
}

function tryChargeImpact(
  unit: CombatUnit,
  units: CombatUnit[],
  atMs: number,
  world: PhysicsWorld,
  ctx: AbilityExecutionContext,
): boolean {
  if (unit.movementType !== 'charge' || !getChargeImpactReady(world, unit.unitId)) {
    return false;
  }

  const ability = getAbilityForUnit(unit.unitType);
  const targets = resolveAbilityTargets(unit, ability, units);
  if (targets.length === 0) {
    return false;
  }

  const lastAttack = ctx.lastAttackMs.get(unit.unitId) ?? Number.NEGATIVE_INFINITY;
  if (atMs - lastAttack < unit.attackDelayMs) {
    return false;
  }

  resetChargeAfterImpact(world, unit.unitId);
  executeAbility(unit, targets, {
    ...ctx,
    chargeDamageScale: getCombatTuning().movement.charge.impactDamageScale,
  });
  return true;
}

export async function runPhysicsSimulation(
  initialUnits: CombatUnit[],
  playerAId: PlayerId,
  playerBId: PlayerId,
  startAtMs = 100,
): Promise<{ playback: PlaybackEvent[]; survivors: CombatUnit[] }> {
  const units = initialUnits.map((unit) => ({ ...unit, statusEffects: unit.statusEffects ?? [] }));
  const playback: PlaybackEvent[] = [];
  const lastAttackMs = new Map<string, number>();
  const pendingAttacks: PendingAbilityAttack[] = [];
  const world = await createPhysicsWorld();
  const movementState = createTerrestrialMovementState();
  world.syncBodies(units);
  world.resetCombatState();
  world.runCombatWarmup(units, getCombatTuning().physics.combatWarmupMs);

  const stepMs = getCombatTuning().simulation.stepMs;
  const maxTicks = getCombatTuning().simulation.maxTickCount;
  const maxMs = stepMs * maxTicks;
  let atMs = startAtMs;

  const prevPositions = new Map<string, { x: number; z: number; height: number }>();
  for (const unit of units) {
    if (unit.hp > 0) {
      prevPositions.set(unit.unitId, {
        x: unit.x,
        z: unit.y,
        height: world.getWorldHeight(unit.unitId, atMs, unit.movementType),
      });
    }
  }

  for (let tick = 0; tick < maxTicks; tick++) {
    if (atMs >= maxMs) {
      break;
    }
    const alive = units.filter((unit) => unit.hp > 0);
    const aliveA = alive.filter((unit) => unit.playerId === playerAId);
    const aliveB = alive.filter((unit) => unit.playerId === playerBId);
    if (aliveA.length === 0 || aliveB.length === 0) {
      break;
    }

    const damageAppliedThisTick = new Map<string, number>();
    const ctx: AbilityExecutionContext = {
      atMs,
      playback,
      pending: pendingAttacks,
      damageAppliedThisTick,
      lastAttackMs,
      world,
    };

    tickStatusEffects(units, atMs, (_sourceUnitId, target, dotDamage) => {
      const applied = Math.min(dotDamage, target.hp);
      if (applied <= 0) {
        return;
      }
      target.hp = Math.max(0, target.hp - applied);
      damageAppliedThisTick.set(target.unitId, (damageAppliedThisTick.get(target.unitId) ?? 0) + applied);
      if (target.hp <= 0) {
        pushDeathEvent(playback, atMs, target, world);
        world.removeUnit(target.unitId);
      }
    });

    processPendingAttacks(atMs, pendingAttacks, units, ctx);
    applyTerrestrialCombatStep(world, units, movementState, atMs, playerAId, playerBId);

    for (const unit of alive) {
      if (unit.hp <= 0) {
        continue;
      }

      const ability = getAbilityForUnit(unit.unitType);
      const targets = resolveAbilityTargets(unit, ability, alive);

      if (targets.length === 0) {
        if (tryChargeImpact(unit, units, atMs, world, ctx)) {
          continue;
        }
        continue;
      }

      if (tryChargeImpact(unit, units, atMs, world, ctx)) {
        continue;
      }
      decayChargeWhenHolding(world, unit.unitId);

      const lastAttack = lastAttackMs.get(unit.unitId) ?? Number.NEGATIVE_INFINITY;
      if (atMs - lastAttack >= unit.attackDelayMs) {
        const liveTargets = targets.filter((target) => target.hp > 0);
        executeAbility(unit, liveTargets, ctx);
      }
    }

    const aliveAfter = units.filter((unit) => unit.hp > 0);
    for (const unit of aliveAfter) {
      if (unit.hp <= 0) {
        continue;
      }
      const prev = prevPositions.get(unit.unitId);
      if (!prev) {
        continue;
      }
      world.recordMoveEvent(playback, atMs, unit, prev.x, prev.z, prev.height);
      prevPositions.set(unit.unitId, {
        x: unit.x,
        z: unit.y,
        height: world.getWorldHeight(unit.unitId, atMs, unit.movementType),
      });
    }

    atMs += stepMs;
  }

  const survivors = units.filter((unit) => unit.hp > 0);
  return { playback, survivors };
}
