import type { CombatUnit } from '../../types/domain.js';
import { getCombatTuning, simStepMs } from '../../config/combat-tuning.js';
import { isMeleeUnit } from '../field-layout.js';
import { fieldScale } from './coords.js';
import {
  computeMovement,
  computeSeparation,
  createMovementState,
  unitBaseStep,
  type MovementState,
} from '../unit-movement.js';
import type { PlayerId } from '../../types/domain.js';
import { findEnemyInRange, findEnemiesInRange } from './forces.js';
import type { PhysicsWorld } from './world.js';

function findNearestEnemy(unit: CombatUnit, units: CombatUnit[]): CombatUnit | null {
  let nearest: CombatUnit | null = null;
  let nearestDist = Infinity;
  for (const other of units) {
    if (other.playerId === unit.playerId || other.hp <= 0) {
      continue;
    }
    const dist = Math.hypot(unit.x - other.x, unit.y - other.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }
  return nearest;
}

function fieldDeltaToWorldSpeed(dx: number, dy: number, stepMs: number): { vx: number; vz: number } {
  const scale = fieldScale();
  const sec = Math.max(0.001, stepMs / 1000);
  return { vx: (dx * scale) / sec, vz: (dy * scale) / sec };
}

/**
 * Sphere collision combat: kinematic intent drives Rapier bodies; melee presses while attacking,
 * ranged holds position and gets shoved by lighter mass + low drive blend.
 */
export function applyTerrestrialCombatStep(
  world: PhysicsWorld,
  units: CombatUnit[],
  movementState: MovementState,
  atMs: number,
  _playerAId: PlayerId,
  _playerBId: PlayerId,
): void {
  const movement = getCombatTuning().movement;
  const physics = getCombatTuning().physics;
  const stepMs = simStepMs();
  const alive = units.filter((unit) => unit.hp > 0);

  for (const unit of alive) {
    const allies = alive.filter(
      (other) => other.playerId === unit.playerId && other.unitId !== unit.unitId,
    );
    const attackRange = unit.attackRange;
    const targetsInRange =
      unit.attackType === 'multi'
        ? findEnemiesInRange(unit, alive, attackRange)
        : (() => {
            const primary = findEnemyInRange(unit, alive, attackRange);
            return primary ? [primary] : [];
          })();

    let dx = 0;
    let dy = 0;
    let didHop = false;
    let chargeMultiplier = world.getChargeMultiplier(unit.unitId);
    const holdingRanged = targetsInRange.length > 0 && !isMeleeUnit(unit);

    if (targetsInRange.length > 0) {
      const sep = computeSeparation(unit, allies, movement.holdSeparationStrength);
      dx = sep.dx;
      dy = sep.dy;

      if (isMeleeUnit(unit)) {
        const target = targetsInRange[0] ?? findNearestEnemy(unit, alive);
        if (target) {
          const ex = target.x - unit.x;
          const ey = target.y - unit.y;
          const len = Math.hypot(ex, ey) || 1;
          const push = unitBaseStep(unit) * physics.meleeAttackPushScale;
          dx += (ex / len) * push * movement.advanceTowardEnemyXWeight;
          dy += (ey / len) * push * movement.advanceTowardEnemyYWeight;
        }
      }
    } else {
      const enemy = findNearestEnemy(unit, alive);
      const step = computeMovement(
        unit,
        allies,
        enemy,
        unitBaseStep(unit),
        atMs,
        movementState,
      );
      dx = step.dx;
      dy = step.dy;
      didHop = step.didHop;
      chargeMultiplier = step.chargeMultiplier;
      world.setChargeMultiplier(unit.unitId, chargeMultiplier);
    }

    const { vx, vz } = fieldDeltaToWorldSpeed(dx, dy, stepMs);
    world.applyMovementDrive(unit.unitId, vx, vz, { holdingRanged });

    if (didHop) {
      world.markHopVisual(unit.unitId, atMs);
    }
  }

  world.stepForSimMs(stepMs);
  world.clampUnitsToGround(units);
  world.syncAllUnits(units);
}

export function createTerrestrialMovementState(): MovementState {
  return createMovementState();
}
