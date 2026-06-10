import type { CombatUnit, PlaybackEvent } from '../../types/domain.js';
import { getCombatTuning } from '../../config/combat-tuning.js';
import { fieldXToWorld, fieldZToWorld, worldBodyRadius } from './coords.js';
import { applyFormationSlotForces } from './forces.js';
import type { PhysicsWorld, SlotTarget } from './world.js';

export interface SettleOptions {
  atMs: number;
  sampleMs?: number;
}

export interface SettleResult {
  endMs: number;
}

function bodySpawnHeight(unit: CombatUnit): number {
  const tuning = getCombatTuning().physics;
  return worldBodyRadius(unit.level) + tuning.spawnLift;
}

export function settleUntilSleep(
  world: PhysicsWorld,
  units: CombatUnit[],
  playback: PlaybackEvent[],
  options: SettleOptions,
): SettleResult {
  const tuning = getCombatTuning().physics;
  const sampleMs = options.sampleMs ?? tuning.playbackSampleMs;
  const substepMs = tuning.substepSec * 1000;
  let atMs = options.atMs;
  const endMs = atMs + tuning.settleMaxMs;
  let lastSampleMs = atMs - sampleMs;

  const prevPositions = new Map<string, { x: number; z: number; height: number }>();
  for (const unit of units) {
    if (unit.hp <= 0) {
      continue;
    }
    world.ensureBody(unit, { spawnLift: tuning.spawnLift, wake: true });
    prevPositions.set(unit.unitId, {
      x: unit.x,
      z: unit.y,
      height: world.getWorldHeight(unit.unitId),
    });
  }

  while (atMs < endMs) {
    applyFormationSlotForces(world, units, (unitId) => world.getSlotTarget(unitId));
    world.stepForSimMs(substepMs);
    world.syncAllUnits(units);

    if (atMs - lastSampleMs >= sampleMs) {
      for (const unit of units) {
        if (unit.hp <= 0) {
          continue;
        }
        const prev = prevPositions.get(unit.unitId)!;
        world.recordMoveEvent(playback, atMs, unit, prev.x, prev.z, prev.height);
        prevPositions.set(unit.unitId, {
          x: unit.x,
          z: unit.y,
          height: world.getWorldHeight(unit.unitId),
        });
      }
      lastSampleMs = atMs;
    }

    if (world.allBodiesSleeping()) {
      break;
    }
    atMs += substepMs;
  }

  world.syncAllUnits(units);
  world.clearSlotTargets();
  return { endMs: atMs };
}

export function buildSlotTargets(units: CombatUnit[]): SlotTarget[] {
  return units
    .filter((u) => u.hp > 0)
    .map((u) => ({ unitId: u.unitId, fieldX: u.x, fieldZ: u.y }));
}

export function settleFormation(
  world: PhysicsWorld,
  roster: CombatUnit[],
  beforePositions: Map<string, { x: number; y: number }>,
  playback: PlaybackEvent[],
  atMs: number,
): number {
  const slotTargets: SlotTarget[] = roster
    .filter((u) => u.hp > 0)
    .map((u) => ({ unitId: u.unitId, fieldX: u.x, fieldZ: u.y }));

  for (const unit of roster) {
    if (unit.hp <= 0) {
      continue;
    }
    const before = beforePositions.get(unit.unitId);
    if (before) {
      unit.x = before.x;
      unit.y = before.y;
    }
    world.ensureBody(unit, { wake: true });
    const state = world.getBodyState(unit.unitId)!;
    state.body.setTranslation(
      {
        x: fieldXToWorld(unit.x),
        y: bodySpawnHeight(unit),
        z: fieldZToWorld(unit.y),
      },
      true,
    );
    state.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  world.setSlotTargets(slotTargets);
  const result = settleUntilSleep(world, roster, playback, { atMs });

  for (const slot of slotTargets) {
    const unit = roster.find((u) => u.unitId === slot.unitId);
    if (!unit) {
      continue;
    }
    unit.x = slot.fieldX;
    unit.y = slot.fieldZ;
    const state = world.getBodyState(unit.unitId);
    state?.body.setTranslation(
      {
        x: fieldXToWorld(slot.fieldX),
        y: bodySpawnHeight(unit),
        z: fieldZToWorld(slot.fieldZ),
      },
      true,
    );
  }
  world.syncAllUnits(roster);
  return result.endMs;
}

export function settleSpawnOverlap(
  world: PhysicsWorld,
  units: CombatUnit[],
  playback: PlaybackEvent[],
  atMs: number,
): number {
  world.setSlotTargets(buildSlotTargets(units));
  return settleUntilSleep(world, units, playback, { atMs }).endMs;
}
