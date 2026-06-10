import type { CombatUnit, PlaybackEvent, PlayerId } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { computeAttackDamage, getMaxDamagePerTick, getUnitDisplayName } from '../../game-data/index.js';
import {
  decayChargeWhenHolding,
  findEnemiesInRange,
  findEnemyInRange,
  getChargeImpactReady,
  resetChargeAfterImpact,
} from './forces.js';
import {
  applyTerrestrialCombatStep,
  createTerrestrialMovementState,
} from './terrestrial-locomotion.js';
import { createPhysicsWorld, type PhysicsWorld } from './world.js';

interface PendingAttack {
  landAtMs: number;
  attacker: Pick<CombatUnit, 'unitId' | 'unitType' | 'x' | 'y' | 'attackType' | 'travelTimeMs' | 'movementType'>;
  targetId: string;
  damage: number;
}

function computeUnitDamage(attacker: CombatUnit, target: CombatUnit): number {
  return attacker.damage ?? computeAttackDamage(attacker.attack, target.defense);
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

function pushAttackEvent(
  playback: PlaybackEvent[],
  atMs: number,
  attacker: Pick<CombatUnit, 'unitId' | 'unitType' | 'x' | 'y' | 'attackType' | 'travelTimeMs' | 'movementType'>,
  target: CombatUnit,
  damage: number,
  world: PhysicsWorld,
  options?: { durationMs?: number; travelTimeMs?: number },
): void {
  playback.push({
    atMs,
    kind: 'attack',
    description: `${getUnitDisplayName(attacker.unitType)} hits ${getUnitDisplayName(target.unitType)} for ${damage}`,
    sourceUnitId: attacker.unitId,
    targetUnitId: target.unitId,
    x: attacker.x,
    y: attacker.y,
    x2: target.x,
    y2: target.y,
    height: world.getWorldHeight(attacker.unitId, atMs, attacker.movementType),
    attackType: attacker.attackType,
    travelTimeMs: options?.travelTimeMs ?? attacker.travelTimeMs,
    damage,
    durationMs: options?.durationMs,
  });
}

function attackLineFlashMs(): number {
  return getCombatTuning().playback.attackLineFlashMs;
}

function processPendingAttacks(
  atMs: number,
  pending: PendingAttack[],
  units: CombatUnit[],
  playback: PlaybackEvent[],
  damageAppliedThisTick: Map<string, number>,
  world: PhysicsWorld,
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
    const damage = cappedDamage(attack.damage, target, damageAppliedThisTick);
    if (damage <= 0) {
      pending.splice(index, 1);
      continue;
    }
    applyDamage(target, damage, damageAppliedThisTick);
    pushAttackEvent(playback, atMs, attack.attacker, target, damage, world, {
      durationMs: 0,
      travelTimeMs: attack.attacker.travelTimeMs,
    });
    if (target.hp <= 0) {
      pushDeathEvent(playback, atMs, target, world);
      world.removeUnit(target.unitId);
    }
    pending.splice(index, 1);
  }
}

function tryChargeImpact(
  unit: CombatUnit,
  units: CombatUnit[],
  atMs: number,
  world: PhysicsWorld,
  playback: PlaybackEvent[],
  pendingAttacks: PendingAttack[],
  damageAppliedThisTick: Map<string, number>,
  lastAttackMs: Map<string, number>,
): boolean {
  if (unit.movementType !== 'charge' || !getChargeImpactReady(world, unit.unitId)) {
    return false;
  }

  const charge = getCombatTuning().movement.charge;
  const targets =
    unit.attackType === 'multi'
      ? findEnemiesInRange(unit, units, unit.attackRange)
      : (() => {
          const primary = findEnemyInRange(unit, units, unit.attackRange);
          return primary ? [primary] : [];
        })();
  if (targets.length === 0) {
    return false;
  }

  const lastAttack = lastAttackMs.get(unit.unitId) ?? Number.NEGATIVE_INFINITY;
  if (atMs - lastAttack < unit.attackDelayMs) {
    return false;
  }

  lastAttackMs.set(unit.unitId, atMs);
  resetChargeAfterImpact(world, unit.unitId);

  if (unit.attackType === 'multi') {
    for (const target of targets) {
      const rawDamage = Math.ceil(computeUnitDamage(unit, target) * charge.impactDamageScale);
      const damage = cappedDamage(rawDamage, target, damageAppliedThisTick);
      if (damage <= 0) {
        continue;
      }
      applyDamage(target, damage, damageAppliedThisTick);
      pushAttackEvent(playback, atMs, unit, target, damage, world, { durationMs: attackLineFlashMs() });
      if (target.hp <= 0) {
        pushDeathEvent(playback, atMs, target, world);
        world.removeUnit(target.unitId);
      }
    }
    return true;
  }

  const target = targets[0]!;
  const rawDamage = Math.ceil(computeUnitDamage(unit, target) * charge.impactDamageScale);
  const damage = cappedDamage(rawDamage, target, damageAppliedThisTick);
  if (damage <= 0) {
    return false;
  }

  if (unit.attackType === 'projectile') {
    pushAttackEvent(playback, atMs, unit, target, damage, world, {
      durationMs: unit.travelTimeMs,
      travelTimeMs: unit.travelTimeMs,
    });
    pendingAttacks.push({
      landAtMs: atMs + unit.travelTimeMs,
      attacker: { ...unit },
      targetId: target.unitId,
      damage: rawDamage,
    });
    return true;
  }

  applyDamage(target, damage, damageAppliedThisTick);
  pushAttackEvent(playback, atMs, unit, target, damage, world, {
    durationMs: unit.attackType === 'line' ? attackLineFlashMs() : 0,
  });
  if (target.hp <= 0) {
    pushDeathEvent(playback, atMs, target, world);
    world.removeUnit(target.unitId);
  }
  return true;
}

function fireAttack(
  unit: CombatUnit,
  targets: CombatUnit[],
  atMs: number,
  playback: PlaybackEvent[],
  pending: PendingAttack[],
  damageAppliedThisTick: Map<string, number>,
  lastAttackMs: Map<string, number>,
  world: PhysicsWorld,
): void {
  if (targets.length === 0) {
    return;
  }

  lastAttackMs.set(unit.unitId, atMs);

  if (unit.attackType === 'multi') {
    for (const target of targets) {
      const rawDamage = computeUnitDamage(unit, target);
      const damage = cappedDamage(rawDamage, target, damageAppliedThisTick);
      if (damage <= 0) {
        continue;
      }
      applyDamage(target, damage, damageAppliedThisTick);
      pushAttackEvent(playback, atMs, unit, target, damage, world, { durationMs: attackLineFlashMs() });
      if (target.hp <= 0) {
        pushDeathEvent(playback, atMs, target, world);
        world.removeUnit(target.unitId);
      }
    }
    return;
  }

  const target = targets[0]!;
  const rawDamage = computeUnitDamage(unit, target);
  const damage = cappedDamage(rawDamage, target, damageAppliedThisTick);
  if (damage <= 0) {
    return;
  }

  if (unit.attackType === 'projectile') {
    pushAttackEvent(playback, atMs, unit, target, damage, world, {
      durationMs: unit.travelTimeMs,
      travelTimeMs: unit.travelTimeMs,
    });
    pending.push({
      landAtMs: atMs + unit.travelTimeMs,
      attacker: { ...unit },
      targetId: target.unitId,
      damage: rawDamage,
    });
    return;
  }

  applyDamage(target, damage, damageAppliedThisTick);
  pushAttackEvent(playback, atMs, unit, target, damage, world, {
    durationMs: unit.attackType === 'line' ? attackLineFlashMs() : 0,
  });
  if (target.hp <= 0) {
    pushDeathEvent(playback, atMs, target, world);
    world.removeUnit(target.unitId);
  }
}

export async function runPhysicsSimulation(
  initialUnits: CombatUnit[],
  playerAId: PlayerId,
  playerBId: PlayerId,
  startAtMs = 100,
): Promise<{ playback: PlaybackEvent[]; survivors: CombatUnit[] }> {
  const units = initialUnits.map((unit) => ({ ...unit }));
  const playback: PlaybackEvent[] = [];
  const lastAttackMs = new Map<string, number>();
  const pendingAttacks: PendingAttack[] = [];
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
    processPendingAttacks(atMs, pendingAttacks, units, playback, damageAppliedThisTick, world);

    applyTerrestrialCombatStep(world, units, movementState, atMs, playerAId, playerBId);

    for (const unit of alive) {
      if (unit.hp <= 0) {
        continue;
      }
      const allies = alive.filter(
        (other) => other.playerId === unit.playerId && other.unitId !== unit.unitId,
      );
      const attackRange = unit.attackRange;
      const primaryTarget = findEnemyInRange(unit, alive, attackRange);
      const targetsInRange =
        unit.attackType === 'multi'
          ? findEnemiesInRange(unit, alive, attackRange)
          : primaryTarget
            ? [primaryTarget]
            : [];

      if (targetsInRange.length === 0) {
        if (
          tryChargeImpact(
            unit,
            units,
            atMs,
            world,
            playback,
            pendingAttacks,
            damageAppliedThisTick,
            lastAttackMs,
          )
        ) {
          continue;
        }
      } else {
        if (
          tryChargeImpact(
            unit,
            units,
            atMs,
            world,
            playback,
            pendingAttacks,
            damageAppliedThisTick,
            lastAttackMs,
          )
        ) {
          continue;
        }
        decayChargeWhenHolding(world, unit.unitId);

        const lastAttack = lastAttackMs.get(unit.unitId) ?? Number.NEGATIVE_INFINITY;
        if (atMs - lastAttack >= unit.attackDelayMs) {
          const liveTargets = targetsInRange.filter((target) => target.hp > 0);
          fireAttack(
            unit,
            liveTargets,
            atMs,
            playback,
            pendingAttacks,
            damageAppliedThisTick,
            lastAttackMs,
            world,
          );
        }
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
