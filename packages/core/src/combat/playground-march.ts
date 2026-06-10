import { getUnitDisplayName } from '../game-data/index.js';
import { getCombatTuning } from '../config/combat-tuning.js';
import type { CombatUnit, PlaybackEvent, PlayerId } from '../types/domain.js';
import { ENEMY_BACK_Y, PLAYER_BACK_Y } from './field-layout.js';
import {
  clampFieldCoordinate,
  computeMovement,
  createMovementState,
  recordUnitMoveEvent,
  resolveAllyOverlaps,
  type MovementState,
  unitBaseStep,
} from './unit-movement.js';
import { simStepMs } from '../config/combat-tuning.js';

export const PLAYGROUND_MARCH_END_Y = ENEMY_BACK_Y;

export function playgroundMarchIdleMs(): number {
  return getCombatTuning().playground.marchIdleMs;
}

/** @deprecated Use playgroundMarchIdleMs() for runtime tuning. */
export const PLAYGROUND_MARCH_IDLE_MS = 3000;

export { createMovementState, resetMovementState, type MovementState } from './unit-movement.js';
export { simStepMs } from '../config/combat-tuning.js';

export function runPlaygroundMarchStep(
  units: CombatUnit[],
  playerId: PlayerId,
  atMs: number,
  movementState: MovementState,
  playback: PlaybackEvent[],
): void {
  const { marchHopIntervalMs, marchHopDistanceScale } = getCombatTuning().playground;
  const alive = units.filter((unit) => unit.playerId === playerId && unit.hp > 0);
  const respawned: CombatUnit[] = [];
  const marchOptions = {
    marchDirectionY: -1 as const,
    hopIntervalMs: marchHopIntervalMs,
    hopDistanceScale: marchHopDistanceScale,
  };

  for (const unit of alive) {
    const allies = alive.filter((other) => other.unitId !== unit.unitId);
    const step = computeMovement(
      unit,
      allies,
      null,
      unitBaseStep(unit),
      atMs,
      movementState,
      marchOptions,
    );
    const prevX = unit.x;
    const prevY = unit.y;
    unit.x = clampFieldCoordinate(unit.x + step.dx);
    unit.y = clampFieldCoordinate(unit.y + step.dy);

    if (unit.y <= PLAYGROUND_MARCH_END_Y) {
      playback.push({
        atMs,
        kind: 'death',
        description: `${getUnitDisplayName(unit.unitType)} reached the front`,
        sourceUnitId: unit.unitId,
        x: prevX,
        y: prevY,
      });
      unit.x = 0.5;
      unit.y = PLAYER_BACK_Y;
      movementState.nextHopAtMs.delete(unit.unitId);
      movementState.chargeMultiplier.delete(unit.unitId);
      respawned.push(unit);
      continue;
    }

    recordUnitMoveEvent(playback, atMs, unit, prevX, prevY, step);
  }

  resolveAllyOverlaps(units, playerId);

  for (const unit of respawned) {
    playback.push({
      atMs,
      kind: 'spawn',
      description: `${getUnitDisplayName(unit.unitType)} respawned`,
      sourceUnitId: unit.unitId,
      x: unit.x,
      y: unit.y,
    });
  }
}
