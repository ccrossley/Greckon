import type { CombatUnit, UnitType } from '../src/types/domain.js';
import {
  applyTurnAction,
  createCombatUnit,
  formatTurnActionId,
  isTurnActionValid,
  resetUnitIdCounter,
} from '../src/index.js';
import { describe, expect, it, beforeEach } from 'vitest';

const PLAYER = 'playground';

describe('applyTurnAction', () => {
  beforeEach(() => {
    resetUnitIdCounter();
  });

  function unitsOfType(units: CombatUnit[], unitType: UnitType): CombatUnit[] {
    return units.filter((unit) => unit.playerId === PLAYER && unit.unitType === unitType);
  }

  it('adds units using catalog addAmount and stacks formation rows', () => {
    const units: CombatUnit[] = [];
    const playback = [];
    applyTurnAction(units, PLAYER, formatTurnActionId('add', 'archer'), playback, 0);

    expect(units).toHaveLength(2);
    expect(unitsOfType(units, 'archer')).toHaveLength(2);
    expect(new Set(units.map((unit) => `${unit.x}:${unit.y}`)).size).toBe(2);
    expect(new Set(units.map((unit) => unit.y)).size).toBeGreaterThan(0);
  });

  it('doubles all owned units of a type and relayouts', () => {
    const units = [
      createCombatUnit('p-u1', 'warrior', PLAYER, 0.5, 0.88),
      createCombatUnit('p-u2', 'warrior', PLAYER, 0.55, 0.88),
    ];
    const playback = [];
    applyTurnAction(units, PLAYER, formatTurnActionId('double', 'warrior'), playback, 0);

    expect(unitsOfType(units, 'warrior')).toHaveLength(4);
    expect(new Set(units.map((unit) => `${unit.x}:${unit.y}`)).size).toBe(4);
  });

  it('upgrades every owned unit of a type together', () => {
    const units = [
      createCombatUnit('p-u1', 'mage', PLAYER, 0.5, 0.88),
      createCombatUnit('p-u2', 'mage', PLAYER, 0.55, 0.88),
    ];
    const playback = [];
    applyTurnAction(units, PLAYER, formatTurnActionId('upgrade', 'mage'), playback, 0);

    expect(units.every((unit) => unit.level === 2)).toBe(true);
    expect(playback[0]?.kind).toBe('upgrade');
  });

  it('respects the same validity rules as turn action offers', () => {
    const units = [createCombatUnit('p-u1', 'warrior', PLAYER, 0.5, 0.88)];
    units[0]!.level = 4;
    expect(isTurnActionValid('upgrade', 'warrior', units, PLAYER)).toBe(false);

    const playback = [];
    applyTurnAction(units, PLAYER, formatTurnActionId('upgrade', 'warrior'), playback, 0);
    expect(playback).toHaveLength(0);
    expect(units[0]!.level).toBe(4);
  });
});
