import { beforeAll, describe, expect, it } from 'vitest';
import { initRapier } from '@greckon/core';
import { createCombatUnit, getUnitDefinition, type UnitType } from '@greckon/core';
import {
  createInitialField,
  getAttackRange,
  prepareFieldForNextRound,
  processTurn,
  runSimulation,
} from '../src/battle/round-runner.js';

const OPEN_DRAFT: UnitType[] = [
  'warrior',
  'mage',
  'archer',
  'rogue',
  'healer',
  'scout',
  'berserker',
  'warlock',
  'squire',
  'knight',
  'cleric',
];

function draftPools(
  playerA: UnitType[] = OPEN_DRAFT,
  playerB: UnitType[] = OPEN_DRAFT,
): Record<string, UnitType[]> {
  return { p1: playerA, p2: playerB };
}

describe('combat simulation', () => {
  beforeAll(async () => {
    await initRapier();
  });

  it('eliminates one side in a lopsided matchup', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warrior', 'warrior', 'warrior'],
      picksB: ['healer'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const survivorsA = result.survivors.filter((unit) => unit.playerId === 'p1');
    const survivorsB = result.survivors.filter((unit) => unit.playerId === 'p2');
    expect(survivorsA.length + survivorsB.length).toBeGreaterThan(0);
    expect(survivorsA.length === 0 || survivorsB.length === 0).toBe(true);
  });

  it('includes attack events with line coordinates', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['archer'],
      picksB: ['healer'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const attacks = result.playback.filter((event) => event.kind === 'attack');
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.some((event) => event.attackType === 'line')).toBe(true);
    expect(attacks[0]?.x2).toBeDefined();
  });

  it('requires multiple hits before a unit is eliminated', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warrior'],
      picksB: ['warrior'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const attacks = result.playback.filter((event) => event.kind === 'attack');
    expect(attacks.length).toBeGreaterThan(3);
  });

  it('adds units and doubles the count of an owned type', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['rogue'],
      picksB: ['mage'],
    });
    const withAdd = await processTurn(units, [
      {
        playerId: 'p1',
        turnIndex: 0,
        actions: [{ unitId: 'squad', actionId: 'add:warrior' }],
      },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    expect(withAdd.unitsAfterActions.filter((unit) => unit.playerId === 'p1')).toHaveLength(2);

    const withArcherAdd = await processTurn(units, [
      {
        playerId: 'p1',
        turnIndex: 0,
        actions: [{ unitId: 'squad', actionId: 'add:archer' }],
      },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    expect(getUnitDefinition('archer').addAmount).toBe(2);
    expect(withArcherAdd.unitsAfterActions.filter((unit) => unit.playerId === 'p1')).toHaveLength(3);

    const withDouble = await processTurn(units, [
      {
        playerId: 'p1',
        turnIndex: 0,
        actions: [{ unitId: 'squad', actionId: 'double:rogue' }],
      },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    expect(withDouble.unitsAfterActions.filter((unit) => unit.playerId === 'p1')).toHaveLength(2);
    expect(
      withDouble.unitsAfterActions.filter((unit) => unit.playerId === 'p1' && unit.unitType === 'rogue'),
    ).toHaveLength(2);

    const { units: paired } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warrior', 'warrior'],
      picksB: ['mage'],
    });
    const withDoublePair = await processTurn(paired, [
      {
        playerId: 'p1',
        turnIndex: 0,
        actions: [{ unitId: 'squad', actionId: 'double:warrior' }],
      },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    expect(
      withDoublePair.unitsAfterActions.filter((unit) => unit.playerId === 'p1' && unit.unitType === 'warrior'),
    ).toHaveLength(4);
  });

  it('doubles four archers to eight on the field at fight start', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['mage'],
      picksB: ['healer'],
    });
    let field = units;
    for (let turn = 0; turn < 2; turn++) {
      const addOutcome = await processTurn(field, [
        {
          playerId: 'p1',
          turnIndex: turn,
          actions: [{ unitId: 'squad', actionId: 'add:archer' }],
        },
        { playerId: 'p2', turnIndex: turn, actions: [] },
      ], 'p1', 'p2', draftPools(['mage', 'archer', 'warrior', 'rogue']));
      field = prepareFieldForNextRound(addOutcome.unitsAfterActions, addOutcome.survivors, 'p1', 'p2');
    }

    expect(field.filter((unit) => unit.playerId === 'p1' && unit.unitType === 'archer')).toHaveLength(4);

    const doubleOutcome = await processTurn(field, [
      {
        playerId: 'p1',
        turnIndex: 2,
        actions: [{ unitId: 'squad', actionId: 'double:archer' }],
      },
      { playerId: 'p2', turnIndex: 2, actions: [] },
    ], 'p1', 'p2', draftPools(['mage', 'archer', 'warrior', 'rogue']));

    const archersAtFightStart = doubleOutcome.fieldAtFightStart.filter(
      (unit) => unit.playerId === 'p1' && unit.unitType === 'archer',
    );
    expect(archersAtFightStart).toHaveLength(8);
    expect(new Set(archersAtFightStart.map((unit) => unit.unitId)).size).toBe(8);
  });

  it('respawns killed units between rounds', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warrior'],
      picksB: ['healer'],
    });
    const outcome = await processTurn(units, [
      { playerId: 'p1', turnIndex: 0, actions: [] },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    const next = prepareFieldForNextRound(outcome.unitsAfterActions, outcome.survivors, 'p1', 'p2');
    expect(next).toHaveLength(2);
    expect(next.every((unit) => unit.hp > 0)).toBe(true);
  });

  it('uses normalized attack ranges for melee and ranged units', () => {
    const melee = createCombatUnit('m1', 'warrior', 'p1', 0.5, 0.5);
    const ranged = createCombatUnit('r1', 'scout', 'p1', 0.5, 0.5);
    expect(getAttackRange(melee)).toBeGreaterThan(0.04);
    expect(getAttackRange(ranged)).toBeGreaterThan(getAttackRange(melee));
  });

  it('healers support allies with heal playback events', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['healer', 'warrior'],
      picksB: ['squire'],
    });
    const healer = units.find((unit) => unit.unitType === 'healer');
    const ally = units.find((unit) => unit.unitType === 'warrior' && unit.playerId === 'p1');
    if (healer && ally) {
      ally.hp = Math.max(1, Math.round(ally.maxHp * 0.4));
      healer.x = ally.x - 0.03;
      healer.y = ally.y;
    }
    const result = await runSimulation(units, 'p1', 'p2');
    expect(result.playback.some((event) => event.kind === 'heal')).toBe(true);
  });

  it('emits projectile attacks with travel metadata', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['mage'],
      picksB: ['squire'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    expect(result.playback.some((event) => event.attackType === 'projectile')).toBe(true);
  });

  it('supports multi-target attacks', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warlock'],
      picksB: ['squire', 'rogue'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const multiAttacks = result.playback.filter((event) => event.attackType === 'multi');
    expect(multiAttacks.length).toBeGreaterThan(0);
  });

  it('records hop movement on advancing units', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['berserker'],
      picksB: ['healer'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const hopMoves = result.playback.filter((event) => event.kind === 'move' && event.movementType === 'hop');
    expect(hopMoves.length).toBeGreaterThan(0);
    expect(hopMoves.every((event) => event.x !== undefined && event.y !== undefined)).toBe(true);
  });

  it('records physics height on movement events', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['mage'],
      picksB: ['squire'],
    });
    const result = await runSimulation(units, 'p1', 'p2');
    const moves = result.playback.filter((event) => event.kind === 'move');
    expect(moves.some((event) => event.height !== undefined)).toBe(true);
  });

  it('restores full health for all units between rounds', async () => {
    const { units } = createInitialField({
      playerAId: 'p1',
      playerBId: 'p2',
      picksA: ['warrior'],
      picksB: ['healer'],
    });
    units[0]!.hp = 10;
    const outcome = await processTurn(units, [
      { playerId: 'p1', turnIndex: 0, actions: [] },
      { playerId: 'p2', turnIndex: 0, actions: [] },
    ], 'p1', 'p2', draftPools());
    const next = prepareFieldForNextRound(outcome.unitsAfterActions, outcome.survivors, 'p1', 'p2');
    expect(next.every((unit) => unit.hp === unit.maxHp)).toBe(true);
  });
});
