import type { CombatUnit } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { getMinUnitGap } from '../field-layout.js';
import { horizontalDistanceField } from './coords.js';
import type { PhysicsWorld } from './world.js';

function findNearestEnemy(unit: CombatUnit, units: CombatUnit[]): CombatUnit | null {
  let nearest: CombatUnit | null = null;
  let nearestDist = Infinity;
  for (const other of units) {
    if (other.playerId === unit.playerId || other.hp <= 0) {
      continue;
    }
    const dist = horizontalDistanceField(unit.x, unit.y, other.x, other.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }
  return nearest;
}

function applyAccelXZ(
  world: PhysicsWorld,
  unitId: string,
  ax: number,
  az: number,
): void {
  const state = world.getBodyState(unitId);
  if (!state) {
    return;
  }
  const mass = state.body.mass();
  state.body.addForce({ x: ax * mass, y: 0, z: az * mass }, true);
  state.body.wakeUp();
}

function applyImpulse(
  world: PhysicsWorld,
  unitId: string,
  ix: number,
  iy: number,
  iz: number,
): void {
  const state = world.getBodyState(unitId);
  if (!state) {
    return;
  }
  state.body.applyImpulse({ x: ix, y: iy, z: iz }, true);
  state.body.wakeUp();
}

/** Spring forces toward formation slot targets. */
export function applyFormationSlotForces(
  world: PhysicsWorld,
  units: CombatUnit[],
  getSlot: (unitId: string) => { fieldX: number; fieldZ: number } | undefined,
): void {
  const tuning = getCombatTuning().physics;
  const scale = tuning.fieldScale;

  for (const unit of units) {
    if (unit.hp <= 0) {
      continue;
    }
    const slot = getSlot(unit.unitId);
    if (!slot) {
      continue;
    }
    const state = world.getBodyState(unit.unitId);
    if (!state) {
      continue;
    }
    const dx = (slot.fieldX - unit.x) * scale;
    const dz = (slot.fieldZ - unit.y) * scale;
    const mass = state.body.mass();
    applyAccelXZ(
      world,
      unit.unitId,
      (dx * tuning.slotSpring) / mass,
      (dz * tuning.slotSpring) / mass,
    );
  }
}

export function applyCombatForces(world: PhysicsWorld, units: CombatUnit[]): void {
  const tuning = getCombatTuning().physics;
  const movement = getCombatTuning().movement;
  const scale = tuning.fieldScale;
  const alive = units.filter((u) => u.hp > 0);

  for (const unit of alive) {
    const state = world.getBodyState(unit.unitId);
    if (!state) {
      continue;
    }

    const enemy = findNearestEnemy(unit, alive);
    if (!enemy) {
      const nz = unit.y > 0.5 ? -1 : 1;
      applyAccelXZ(world, unit.unitId, 0, nz * tuning.advanceAccel * 0.35);
      continue;
    }

    const dist = horizontalDistanceField(unit.x, unit.y, enemy.x, enemy.y);
    const holdRange = unit.attackRange * scale * movement.attackHoldRangeFactor;

    if (dist <= holdRange) {
      const v = state.body.linvel();
      state.body.setLinvel({ x: v.x * 0.7, y: v.y, z: v.z * 0.7 }, true);
      continue;
    }

    const dx = (enemy.x - unit.x) * scale;
    const dz = (enemy.y - unit.y) * scale;
    const len = Math.hypot(dx, dz) || 1;
    const nx = dx / len;
    const nz = dz / len;

    const speedFactor = Math.max(0.35, Math.min(1.5, unit.speed / movement.baseSpeedDivisor));
    let accel = tuning.advanceAccel * speedFactor;

    if (unit.movementType === 'charge') {
      const charge = movement.charge;
      const stepMs = getCombatTuning().simulation.stepMs;
      let mult = world.getChargeMultiplier(unit.unitId);
      mult = Math.min(
        charge.maxSpeedMultiplier,
        mult + ((charge.maxSpeedMultiplier - charge.minSpeedMultiplier) * stepMs) / charge.rampDurationMs,
      );
      world.setChargeMultiplier(unit.unitId, mult);
      accel = tuning.chargeForceMax * mult;
    }

    if (unit.movementType === 'float') {
      const mass = state.body.mass();
      state.body.addForce({ x: 0, y: tuning.floatBuoyancy * mass, z: 0 }, true);
    }

    applyAccelXZ(world, unit.unitId, nx * accel, nz * accel);
  }
}

export function applyHopImpulses(world: PhysicsWorld, units: CombatUnit[], atMs: number): void {
  const tuning = getCombatTuning().physics;
  const hopInterval = getCombatTuning().movement.hop.intervalMs;
  const scale = tuning.fieldScale;
  const alive = units.filter((u) => u.hp > 0);

  for (const unit of alive) {
    if (unit.movementType !== 'hop') {
      continue;
    }
    const nextHop = world.getNextHopAtMs(unit.unitId) ?? atMs;
    if (atMs < nextHop) {
      continue;
    }
    world.setNextHopAtMs(unit.unitId, atMs + hopInterval);

    const enemy = findNearestEnemy(unit, alive);
    let nx = 0;
    let nz = unit.y > 0.5 ? -1 : 1;
    if (enemy) {
      const dx = (enemy.x - unit.x) * scale;
      const dz = (enemy.y - unit.y) * scale;
      const len = Math.hypot(dx, dz) || 1;
      nx = dx / len;
      nz = dz / len;
    }

    const state = world.getBodyState(unit.unitId);
    if (!state) {
      continue;
    }
    const mass = state.body.mass();
    applyImpulse(
      world,
      unit.unitId,
      nx * tuning.hopImpulseForward * mass,
      tuning.hopImpulseUp * mass,
      nz * tuning.hopImpulseForward * mass,
    );
  }
}

export function decayChargeWhenHolding(world: PhysicsWorld, unitId: string): void {
  const charge = getCombatTuning().movement.charge;
  const mult = world.getChargeMultiplier(unitId);
  world.setChargeMultiplier(
    unitId,
    Math.max(
      charge.minSpeedMultiplier,
      mult - (charge.maxSpeedMultiplier - charge.minSpeedMultiplier) * 0.08,
    ),
  );
}

export function getChargeImpactReady(world: PhysicsWorld, unitId: string): boolean {
  const charge = getCombatTuning().movement.charge;
  return world.getChargeMultiplier(unitId) >= charge.maxSpeedMultiplier * charge.impactThreshold;
}

export function resetChargeAfterImpact(world: PhysicsWorld, unitId: string): void {
  world.setChargeMultiplier(unitId, getCombatTuning().movement.charge.minSpeedMultiplier);
}

export function horizontalDistanceUnits(a: CombatUnit, b: CombatUnit): number {
  return horizontalDistanceField(a.x, a.y, b.x, b.y);
}

export function findEnemiesInRange(
  unit: CombatUnit,
  units: CombatUnit[],
  attackRange: number,
): CombatUnit[] {
  const scale = getCombatTuning().physics.fieldScale;
  const rangeM = attackRange * scale;
  const enemies: CombatUnit[] = [];
  for (const other of units) {
    if (other.playerId === unit.playerId || other.hp <= 0) {
      continue;
    }
    if (horizontalDistanceField(unit.x, unit.y, other.x, other.y) <= rangeM) {
      enemies.push(other);
    }
  }
  return enemies.sort(
    (left, right) =>
      horizontalDistanceField(unit.x, unit.y, left.x, left.y) -
      horizontalDistanceField(unit.x, unit.y, right.x, right.y),
  );
}

export function findEnemyInRange(
  unit: CombatUnit,
  units: CombatUnit[],
  attackRange: number,
): CombatUnit | null {
  return findEnemiesInRange(unit, units, attackRange)[0] ?? null;
}

export function applyKnockback(
  world: PhysicsWorld,
  attacker: CombatUnit,
  target: CombatUnit,
  strength: number,
): void {
  const tuning = getCombatTuning().physics;
  const scale = tuning.fieldScale;
  const state = world.getBodyState(target.unitId);
  if (!state) {
    return;
  }
  const dx = (target.x - attacker.x) * scale;
  const dz = (target.y - attacker.y) * scale;
  const len = Math.hypot(dx, dz) || 1;
  const mass = state.body.mass();
  const impulse = tuning.hopImpulseForward * strength * mass;
  applyImpulse(world, target.unitId, (dx / len) * impulse, 0, (dz / len) * impulse);
}

export function applyHoldSeparationForces(
  world: PhysicsWorld,
  unit: CombatUnit,
  allies: CombatUnit[],
): void {
  const tuning = getCombatTuning().physics;
  const scale = tuning.fieldScale;

  for (const ally of allies) {
    const dist = horizontalDistanceField(unit.x, unit.y, ally.x, ally.y);
    const gap = getMinUnitGap(unit.level, ally.level) * scale;
    if (dist >= gap) {
      continue;
    }
    const dx = (unit.x - ally.x) * scale;
    const dz = (unit.y - ally.y) * scale;
    const len = Math.hypot(dx, dz) || 1;
    const push = ((gap - dist) / gap) * tuning.advanceAccel * 0.4;
    applyAccelXZ(world, unit.unitId, (dx / len) * push, (dz / len) * push);
  }
}
