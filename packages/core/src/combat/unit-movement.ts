import { getUnitDisplayName } from '../game-data/index.js';
import {
  chargeRampPerMs,
  chargeSpeedRatio,
  floatVisualOffset,
  getCombatTuning,
  simStepMs,
  simTickMs,
} from '../config/combat-tuning.js';
import type { CombatUnit, PlaybackEvent, PlayerId } from '../types/domain.js';
import { FIELD_X_MAX, FIELD_X_MIN, getMinUnitGap } from './field-layout.js';

/** @deprecated Combat sim uses Rapier3D — retained for units-editor playground march only. */

/** @deprecated Use simTickMs() for runtime tuning. */
export const TICK_MS = 50;
/** @deprecated Use simStepMs() for runtime tuning. */
export const SIM_STEP_MS = 250;

export interface MovementState {
  chargeMultiplier: Map<string, number>;
  nextHopAtMs: Map<string, number>;
}

export interface MovementStep {
  dx: number;
  dy: number;
  movedTowardEnemy: boolean;
  didHop: boolean;
  chargeMultiplier: number;
}

export interface ComputeMovementOptions {
  /** Fixed march direction when no enemy (-1 = toward top of field). */
  marchDirectionY?: number;
  hopIntervalMs?: number;
  hopDistanceScale?: number;
}

export function createMovementState(): MovementState {
  return {
    chargeMultiplier: new Map<string, number>(),
    nextHopAtMs: new Map<string, number>(),
  };
}

export function resetMovementState(state: MovementState): void {
  state.chargeMultiplier.clear();
  state.nextHopAtMs.clear();
}

function distance2D(a: Pick<CombatUnit, 'x' | 'y'>, b: Pick<CombatUnit, 'x' | 'y'>): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampFieldCoordinate(value: number): number {
  return Math.max(FIELD_X_MIN, Math.min(FIELD_X_MAX, value));
}

export { chargeSpeedRatio, floatVisualOffset };
export { simStepMs, simTickMs } from '../config/combat-tuning.js';

function getChargeMultiplier(movementState: MovementState, unitId: string): number {
  const { minSpeedMultiplier } = getCombatTuning().movement.charge;
  return movementState.chargeMultiplier.get(unitId) ?? minSpeedMultiplier;
}

export function computeSeparation(
  unit: CombatUnit,
  allies: CombatUnit[],
  strength = 1,
): { dx: number; dy: number } {
  let dx = 0;
  let dy = 0;

  for (const ally of allies) {
    const dist = distance2D(unit, ally);
    const minGap = getMinUnitGap(unit.level, ally.level);
    if (dist >= minGap) {
      continue;
    }
    const nx = dist <= 0.00001 ? (unit.unitId > ally.unitId ? 1 : -1) : (unit.x - ally.x) / dist;
    const ny = dist <= 0.00001 ? 0 : (unit.y - ally.y) / dist;
    const overlap = minGap - dist;
    dx += nx * overlap * strength;
    dy += ny * overlap * strength;
  }

  return { dx, dy };
}

export function computeMovement(
  unit: CombatUnit,
  allies: CombatUnit[],
  enemy: CombatUnit | null,
  baseStep: number,
  atMs: number,
  movementState: MovementState,
  options: ComputeMovementOptions = {},
): MovementStep {
  const tuning = getCombatTuning().movement;
  const charge = tuning.charge;
  let chargeMultiplier = getChargeMultiplier(movementState, unit.unitId);
  const hopIntervalMs = options.hopIntervalMs ?? tuning.hop.intervalMs;
  const hopDistanceScale = options.hopDistanceScale ?? tuning.hop.distanceScale;
  const stepMs = simStepMs();

  if (unit.movementType === 'hop') {
    const nextHopAt = movementState.nextHopAtMs.get(unit.unitId) ?? atMs;
    if (atMs < nextHopAt) {
      return { dx: 0, dy: 0, movedTowardEnemy: false, didHop: false, chargeMultiplier };
    }
  }

  const separation = computeSeparation(unit, allies, tuning.allySeparationStrength);
  let dx = separation.dx;
  let dy = separation.dy;
  let movedTowardEnemy = false;
  let didHop = false;
  let step = baseStep;

  if (unit.movementType === 'hop') {
    step = baseStep * hopDistanceScale;
    movementState.nextHopAtMs.set(unit.unitId, atMs + hopIntervalMs);
    didHop = true;
  } else if (unit.movementType === 'charge') {
    step = baseStep * chargeMultiplier;
  }

  if (enemy) {
    const ex = enemy.x - unit.x;
    const ey = enemy.y - unit.y;
    const len = Math.hypot(ex, ey) || 1;
    const holdRange = unit.attackRange * tuning.attackHoldRangeFactor;
    if (len > holdRange) {
      dy += (ey / len) * step * tuning.advanceTowardEnemyYWeight;
      dx += (ex / len) * step * tuning.advanceTowardEnemyXWeight;
      movedTowardEnemy = true;
    }
  } else if (options.marchDirectionY !== undefined) {
    dy += options.marchDirectionY * step * tuning.advanceTowardEnemyYWeight;
    movedTowardEnemy = true;
  } else {
    dy += (unit.y > 0.5 ? -1 : 1) * step * tuning.defaultAdvanceScale;
    movedTowardEnemy = true;
  }

  if (unit.movementType === 'charge') {
    const rampPerMs = chargeRampPerMs();
    if (movedTowardEnemy) {
      chargeMultiplier = Math.min(
        charge.maxSpeedMultiplier,
        chargeMultiplier + rampPerMs * stepMs,
      );
      movementState.chargeMultiplier.set(unit.unitId, chargeMultiplier);
    } else {
      chargeMultiplier = Math.max(
        charge.minSpeedMultiplier,
        chargeMultiplier - rampPerMs * stepMs * charge.decayMultiplier,
      );
      movementState.chargeMultiplier.set(unit.unitId, chargeMultiplier);
    }
  }

  return { dx, dy, movedTowardEnemy, didHop, chargeMultiplier };
}

export function resolveAllyOverlaps(units: CombatUnit[], playerId: PlayerId): void {
  const allies = units.filter((unit) => unit.playerId === playerId && unit.hp > 0);
  for (let i = 0; i < allies.length; i++) {
    for (let j = i + 1; j < allies.length; j++) {
      const a = allies[i]!;
      const b = allies[j]!;
      const dist = distance2D(a, b);
      const minGap = getMinUnitGap(a.level, b.level);
      if (dist >= minGap) {
        continue;
      }
      const nx = dist <= 0.00001 ? 1 : (a.x - b.x) / dist;
      const ny = dist <= 0.00001 ? 0 : (a.y - b.y) / dist;
      const push = (minGap - dist) / 2;
      a.x = clampFieldCoordinate(a.x + nx * push);
      a.y = clampFieldCoordinate(a.y + ny * push);
      b.x = clampFieldCoordinate(b.x - nx * push);
      b.y = clampFieldCoordinate(b.y - ny * push);
    }
  }
}

export function pushMoveEvent(
  playback: PlaybackEvent[],
  atMs: number,
  unit: CombatUnit,
  x: number,
  y: number,
  options: { visualYOffset?: number; chargeSpeed?: number } = {},
): void {
  playback.push({
    atMs,
    kind: 'move',
    description: `${getUnitDisplayName(unit.unitType)} advances`,
    sourceUnitId: unit.unitId,
    x,
    y,
    movementType: unit.movementType,
    visualYOffset: options.visualYOffset,
    chargeSpeed: options.chargeSpeed,
  });
}

export function recordUnitMoveEvent(
  playback: PlaybackEvent[],
  atMs: number,
  unit: CombatUnit,
  prevX: number,
  prevY: number,
  step: MovementStep,
): void {
  const moved = Math.abs(unit.x - prevX) > 0.0001 || Math.abs(unit.y - prevY) > 0.0001;
  if (!moved) {
    return;
  }

  if (unit.movementType === 'hop' && step.didHop) {
    pushMoveEvent(playback, atMs, unit, unit.x, unit.y);
    return;
  }
  if (unit.movementType === 'float') {
    pushMoveEvent(playback, atMs, unit, unit.x, unit.y, {
      visualYOffset: floatVisualOffset(atMs),
    });
    return;
  }
  if (unit.movementType === 'charge') {
    pushMoveEvent(playback, atMs, unit, unit.x, unit.y, {
      chargeSpeed: chargeSpeedRatio(step.chargeMultiplier),
    });
    return;
  }
  pushMoveEvent(playback, atMs, unit, unit.x, unit.y);
}

export function movementStepScale(): number {
  return simStepMs() / simTickMs();
}

export function unitBaseStep(unit: CombatUnit): number {
  const { baseSpeedDivisor } = getCombatTuning().movement;
  return (unit.speed / baseSpeedDivisor) * movementStepScale();
}
