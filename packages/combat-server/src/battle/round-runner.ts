import {
  applyTurnAction,
  createCombatUnit,
  createUnitId,
  createPhysicsWorld,
  getUnitDisplayName,
  layoutAllFormations,
  layoutPlayerFormation,
  loadGameConfig,
  resetUnitIdCounter,
  runPhysicsSimulation,
  type CombatUnit,
  type PlaybackEvent,
  type PlayerId,
  type UnitType,
} from '@greckon/core';

export { getAttackRange, MELEE_ATTACK_RANGE, RANGED_ATTACK_RANGE, simStepMs, simTickMs } from '@greckon/core';
export { maxSimMs, maxSimTicks } from '@greckon/core';
export { runPhysicsSimulation as runSimulation } from '@greckon/core';

export interface TurnInput {
  playerId: PlayerId;
  turnIndex: number;
  actions: Array<{ unitId: string; actionId: string }>;
}

export interface TurnOutcome {
  turnIndex: number;
  playback: PlaybackEvent[];
  /** Sim time when combat movement begins (after pre-fight actions). */
  fightStartMs: number;
  roundScore: { playerA: number; playerB: number };
  survivors: CombatUnit[];
  unitsAfterActions: CombatUnit[];
  fieldAtFightStart: CombatUnit[];
}

export interface FieldSetup {
  playerAId: PlayerId;
  playerBId: PlayerId;
  picksA: UnitType[];
  picksB: UnitType[];
}

export function resetUnitCounter(): void {
  resetUnitIdCounter();
}

export function appendPlayerPick(
  units: CombatUnit[],
  playerId: PlayerId,
  unitType: UnitType,
  isBottom: boolean,
): CombatUnit {
  const baseY = isBottom ? 0.88 : 0.12;
  const unit = createCombatUnit(createUnitId(playerId), unitType, playerId, 0.5, baseY);
  units.push(unit);
  layoutPlayerFormation(units, playerId, isBottom);
  return unit;
}

function spawnUnitsForPlayer(
  playerId: PlayerId,
  picks: UnitType[],
  isBottom: boolean,
  playback: PlaybackEvent[],
  atMs: number,
): CombatUnit[] {
  const baseY = isBottom ? 0.88 : 0.12;
  const units: CombatUnit[] = picks.map((unitType) =>
    createCombatUnit(createUnitId(playerId), unitType, playerId, 0.5, baseY),
  );
  layoutPlayerFormation(units, playerId, isBottom);
  for (const unit of units) {
    playback.push({
      atMs,
      kind: 'spawn',
      description: `${getUnitDisplayName(unit.unitType)} spawned`,
      sourceUnitId: unit.unitId,
      x: unit.x,
      y: unit.y,
      height: 0,
    });
  }
  return units;
}

export function createInitialField(setup: FieldSetup): { units: CombatUnit[]; playback: PlaybackEvent[] } {
  const playback: PlaybackEvent[] = [];
  const units = [
    ...spawnUnitsForPlayer(setup.playerAId, setup.picksA, true, playback, 0),
    ...spawnUnitsForPlayer(setup.playerBId, setup.picksB, false, playback, 0),
  ];
  return { units, playback };
}

export async function processTurn(
  units: CombatUnit[],
  inputs: TurnInput[],
  playerAId: PlayerId,
  playerBId: PlayerId,
  draftPools: Record<PlayerId, UnitType[]>,
): Promise<TurnOutcome> {
  const turnIndex = inputs[0]?.turnIndex ?? 0;
  const fieldUnits = units.map((unit) => ({ ...unit }));
  const playback: PlaybackEvent[] = [];
  const physics = await createPhysicsWorld();
  physics.syncBodies(fieldUnits);

  const pickCount = loadGameConfig().roundActionPickCount;
  let actionAtMs = 50;

  for (const input of inputs) {
    for (const action of input.actions.slice(0, pickCount)) {
      applyTurnAction(
        fieldUnits,
        input.playerId,
        action.actionId,
        playback,
        actionAtMs,
        draftPools[input.playerId],
        physics,
      );
      actionAtMs += 50;
    }
  }

  layoutAllFormations(fieldUnits, playerAId, playerBId);
  const fieldAtFightStart = fieldUnits.map((unit) => ({ ...unit }));
  const fightStartMs = actionAtMs;

  const sim = await runPhysicsSimulation(fieldUnits, playerAId, playerBId, fightStartMs);
  playback.push(...sim.playback);

  const survivorsA = sim.survivors.filter((unit) => unit.playerId === playerAId).length;
  const survivorsB = sim.survivors.filter((unit) => unit.playerId === playerBId).length;

  let scoreA = 0;
  let scoreB = 0;
  if (survivorsA > 0 && survivorsB === 0) {
    scoreA = 1;
  } else if (survivorsB > 0 && survivorsA === 0) {
    scoreB = 1;
  } else if (survivorsA > survivorsB) {
    scoreA = 1;
  } else if (survivorsB > survivorsA) {
    scoreB = 1;
  } else {
    scoreA = 1;
  }

  return {
    turnIndex,
    playback,
    fightStartMs,
    roundScore: { playerA: scoreA, playerB: scoreB },
    survivors: sim.survivors,
    unitsAfterActions: fieldUnits.map((unit) => ({ ...unit })),
    fieldAtFightStart,
  };
}

export function prepareFieldForNextRound(
  foughtUnits: CombatUnit[],
  survivors: CombatUnit[],
  playerAId: PlayerId,
  playerBId: PlayerId,
): CombatUnit[] {
  const survivorById = new Map(survivors.map((unit) => [unit.unitId, unit]));
  const next: CombatUnit[] = [];

  for (const unit of foughtUnits) {
    const survived = survivorById.get(unit.unitId);
    const restored = survived ? { ...survived } : { ...unit };
    restored.hp = restored.maxHp;
    next.push(restored);
  }

  layoutAllFormations(next, playerAId, playerBId);
  return next;
}

export function runRound(
  _matchId: import('@greckon/core').MatchId,
  _round: number,
  _roundWins: { playerA: number; playerB: number },
): Promise<{ winnerPlayerId?: PlayerId; roundWins: { playerA: number; playerB: number } }> {
  throw new Error('Not implemented');
}
