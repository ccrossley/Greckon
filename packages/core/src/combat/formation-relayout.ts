import { getUnitDefinition, getUnitDisplayName } from '../game-data/index.js';
import type { CombatUnit, PlaybackEvent, PlayerId } from '../types/domain.js';
import { layoutPlayerFormation } from './field-layout.js';
import type { PhysicsWorld } from './physics/world.js';
import { settleFormation } from './physics/settle.js';

function originKey(x: number, y: number): string {
  return `${x.toFixed(5)}:${y.toFixed(5)}`;
}

export function relayoutPlayerFormation(
  units: CombatUnit[],
  playerId: PlayerId,
  isBottom: boolean,
  playback: PlaybackEvent[],
  atMs: number,
  physics?: PhysicsWorld,
): void {
  const roster = units.filter((unit) => unit.playerId === playerId && unit.hp > 0);
  const before = new Map(roster.map((unit) => [unit.unitId, { x: unit.x, y: unit.y }]));

  layoutPlayerFormation(units, playerId, isBottom);

  if (physics) {
    settleFormation(physics, roster, before, playback, atMs);
    return;
  }

  for (const unit of roster) {
    const origin = before.get(unit.unitId);
    if (!origin) {
      continue;
    }
    const destX = unit.x;
    const destY = unit.y;
    const distance = Math.hypot(destX - origin.x, destY - origin.y);
    if (distance < 0.0001) {
      continue;
    }
    unit.x = origin.x;
    unit.y = origin.y;
    playback.push({
      atMs,
      kind: 'move',
      description: `${getUnitDisplayName(unit.unitType)} repositions`,
      sourceUnitId: unit.unitId,
      x: destX,
      y: destY,
      movementType: getUnitDefinition(unit.unitType).movementType,
    });
    unit.x = destX;
    unit.y = destY;
  }
}
