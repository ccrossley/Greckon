import { describe, expect, it } from 'vitest';
import {
  listUnitTypes,
  pickBotTurnAction,
  pickRandomTurnAction,
  pickRandomUnitType,
} from '../src/index.js';

describe('random choice', () => {
  it('picks a deterministic random unit for timeouts', () => {
    const available = listUnitTypes();
    const first = pickRandomUnitType(available, 1, 'p1');
    const second = pickRandomUnitType(available, 1, 'p1');
    expect(first).toBe(second);
    expect(available).toContain(first);
  });

  it('varies unit picks by pick index', () => {
    const available = listUnitTypes();
    const pick1 = pickRandomUnitType(available, 1, 'p1');
    const pick2 = pickRandomUnitType(available, 2, 'p1');
    expect(pick1).not.toBe(pick2);
  });

  it('picks a random action when timed out', () => {
    const actions = [
      { unitId: 'squad', actionId: 'add:warrior', label: 'Add Warrior' },
      { unitId: 'squad', actionId: 'upgrade:mage', label: 'Upgrade Mage' },
    ];
    const pick = pickRandomTurnAction(actions, 0, 'p2');
    expect(pick).not.toBeNull();
    expect(actions).toContainEqual(pick);
  });

  it('weights bot actions toward add and upgrade', () => {
    const actions = [
      { unitId: 'squad', actionId: 'double:warrior', label: 'Double Warrior' },
      { unitId: 'squad', actionId: 'add:archer', label: 'Add Archer' },
    ];
    const picks = Array.from({ length: 24 }, (_, turnIndex) =>
      pickBotTurnAction(actions, turnIndex, 'bot')?.actionId,
    );
    const addCount = picks.filter((id) => id === 'add:archer').length;
    const doubleCount = picks.filter((id) => id === 'double:warrior').length;
    expect(addCount).toBeGreaterThan(doubleCount);
  });
});
