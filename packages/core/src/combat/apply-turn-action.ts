import { createCombatUnit, getUnitDefinition, getUnitDisplayName } from '../game-data/index.js';
import type { CombatUnit, PlaybackEvent, PlayerId, UnitType } from '../types/domain.js';
import { getMinUnitGap } from './field-layout.js';
import { relayoutPlayerFormation } from './formation-relayout.js';
import type { PhysicsWorld } from './physics/world.js';
import { isTurnActionValid, parseTurnActionId } from './turn-actions.js';
import { MAX_UNIT_LEVEL } from './visual.js';

let nextUnitCounter = 0;

export function resetUnitIdCounter(): void {
  nextUnitCounter = 0;
}

export function createUnitId(playerId: PlayerId): string {
  nextUnitCounter += 1;
  return `${playerId}-u${nextUnitCounter}`;
}

export function playerIsBottom(units: CombatUnit[], playerId: PlayerId): boolean {
  const sample = units.find((unit) => unit.playerId === playerId);
  return sample ? sample.y >= 0.5 : true;
}

export function applyTurnAction(
  units: CombatUnit[],
  playerId: PlayerId,
  actionId: string,
  playback: PlaybackEvent[],
  atMs: number,
  allowedUnitTypes?: UnitType[],
  physics?: PhysicsWorld,
): void {
  const parsed = parseTurnActionId(actionId);
  if (!parsed) {
    return;
  }

  const { kind, unitType } = parsed;
  if (!isTurnActionValid(kind, unitType, units, playerId, allowedUnitTypes)) {
    return;
  }

  const owned = units.filter((unit) => unit.playerId === playerId && unit.hp > 0);

  if (kind === 'upgrade') {
    const ofType = owned.filter((unit) => unit.unitType === unitType);
    const currentLevel = ofType.length > 0 ? Math.max(...ofType.map((unit) => unit.level)) : 0;
    if (ofType.length === 0 || currentLevel >= MAX_UNIT_LEVEL) {
      return;
    }
    const newLevel = currentLevel + 1;
    for (const unit of ofType) {
      unit.level = newLevel;
    }
    const target = ofType[0]!;
    playback.push({
      atMs,
      kind: 'upgrade',
      description: `Upgraded ${getUnitDisplayName(unitType)} to size ${newLevel}`,
      sourceUnitId: target.unitId,
      x: target.x,
      y: target.y,
    });
    relayoutPlayerFormation(units, playerId, playerIsBottom(units, playerId), playback, atMs, physics);
    return;
  }

  if (kind === 'double') {
    const ofType = owned.filter((unit) => unit.unitType === unitType);
    if (ofType.length === 0) {
      return;
    }
    for (const source of ofType) {
      const copy = createCombatUnit(createUnitId(playerId), unitType, playerId, source.x, source.y, source.level);
      copy.hp = source.hp;
      copy.maxHp = source.maxHp;
      copy.attack = source.attack;
      copy.defense = source.defense;
      copy.speed = source.speed;
      units.push(copy);
    }
    relayoutPlayerFormation(units, playerId, playerIsBottom(units, playerId), playback, atMs, physics);
    return;
  }

  if (kind === 'add') {
    const definition = getUnitDefinition(unitType);
    const isBottom = playerIsBottom(units, playerId);
    const baseY = isBottom ? 0.88 : 0.12;
    for (let count = 0; count < definition.addAmount; count++) {
      const spread = (count - (definition.addAmount - 1) / 2) * getMinUnitGap(1, 1);
      units.push(createCombatUnit(createUnitId(playerId), unitType, playerId, 0.5 + spread, baseY));
    }
    relayoutPlayerFormation(units, playerId, isBottom, playback, atMs, physics);
  }
}
