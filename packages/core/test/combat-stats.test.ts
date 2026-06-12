import { describe, expect, it } from 'vitest';
import {
  buildPlayerTurnActions,
  computeAttackDamage,
  createCombatUnit,
  generateBaseStats,
  getAttackCooldownMs,
  getMaxDamagePerTick,
  getStatBudget,
  getTurnUnitTypes,
  getUnitDisplayName,
  isTurnActionValid,
  listUnitTypes,
  parseTurnActionId,
} from '../src/index.js';

describe('combat stats', () => {
  it('lists 12 unit types', () => {
    expect(listUnitTypes()).toHaveLength(36);
  });

  it('gives every unit a themed name', () => {
    expect(getUnitDisplayName('healer')).toBe('Healer');
    expect(getUnitDisplayName('warrior')).toBe('Warrior');
    expect(getUnitDisplayName('berserker')).toBe('Berserker');
    expect(getUnitDisplayName('mystic')).toBe('Mystic');
  });

  it('assigns evens as melee and odds as ranged', () => {
    expect(generateBaseStats(2).isRanged).toBe(false);
    expect(generateBaseStats(3).isRanged).toBe(true);
  });

  it('gives melee more attack and defense than ranged at same tier', () => {
    const melee = generateBaseStats(4);
    const ranged = generateBaseStats(3);
    expect(melee.attack + melee.defense).toBeGreaterThan(ranged.attack + ranged.defense);
  });

  it('scales stat budget with index', () => {
    expect(getStatBudget(12)).toBeGreaterThan(getStatBudget(1));
  });

  it('keeps per-hit damage well below one-shot thresholds', () => {
    const warrior = generateBaseStats(12);
    const healer = generateBaseStats(1);
    const hit = computeAttackDamage(warrior.attack, healer.defense);
    expect(hit).toBeLessThan(healer.maxHp);
  });

  it('spaces attacks by speed-based cooldown', () => {
    const fast = getAttackCooldownMs(generateBaseStats(12).speed);
    const slow = getAttackCooldownMs(generateBaseStats(1).speed);
    expect(fast).toBeLessThan(slow);
    expect(fast).toBeGreaterThanOrEqual(500);
  });

  it('caps burst damage per tick to a fraction of max hp', () => {
    const healer = generateBaseStats(1);
    expect(getMaxDamagePerTick(healer.maxHp)).toBeLessThan(healer.maxHp);
    expect(getMaxDamagePerTick(20)).toBe(7);
  });

  it('sets ranged range to 5 and melee range to 1', () => {
    expect(generateBaseStats(5).range).toBe(5);
    expect(generateBaseStats(6).range).toBe(1);
  });

  it('rotates turn unit types', () => {
    const turn0 = getTurnUnitTypes(0);
    const turn1 = getTurnUnitTypes(1);
    expect(turn0).toHaveLength(4);
    expect(turn1).not.toEqual(turn0);
  });
});

describe('turn actions', () => {
  const playerId = 'p1';
  const units = [
    createCombatUnit('u1', 'warrior', playerId, 0.5, 0.88),
    createCombatUnit('u2', 'warrior', playerId, 0.6, 0.88),
    createCombatUnit('u3', 'mage', playerId, 0.7, 0.88),
  ];

  const draft: UnitType[] = ['warrior', 'mage', 'archer'];

  it('offers exactly three weighted action choices per pick step', () => {
    const offers = buildPlayerTurnActions(0, playerId, units, draft, 3, 1);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((offer) => offer.actionId)).size).toBe(3);
    expect(offers.every((offer) => parseTurnActionId(offer.actionId))).toBe(true);
  });

  it('rolls different action offers on each pick step', () => {
    const step1 = buildPlayerTurnActions(0, playerId, units, draft, 3, 1).map((offer) => offer.actionId);
    const step2 = buildPlayerTurnActions(0, playerId, units, draft, 3, 2).map((offer) => offer.actionId);
    const step3 = buildPlayerTurnActions(0, playerId, units, draft, 3, 3).map((offer) => offer.actionId);
    const allSteps = [...step1, ...step2, ...step3];
    expect(new Set(allSteps).size).toBeGreaterThan(3);
  });

  it('weights add more often than double across turns', () => {
    let addCount = 0;
    let doubleCount = 0;
    for (let turn = 0; turn < 200; turn++) {
      for (const offers of [
        buildPlayerTurnActions(turn, 'p1', units, draft),
        buildPlayerTurnActions(turn, 'p2', units, draft),
      ]) {
        for (const offer of offers) {
          const parsed = parseTurnActionId(offer.actionId);
          if (parsed?.kind === 'add') {
            addCount++;
          }
          if (parsed?.kind === 'double') {
            doubleCount++;
          }
        }
      }
    }
    expect(addCount).toBeGreaterThan(doubleCount * 2);
  });

  it('requires ownership for upgrade', () => {
    expect(isTurnActionValid('upgrade', 'mage', units, playerId)).toBe(true);
    expect(isTurnActionValid('upgrade', 'archer', units, playerId)).toBe(false);
  });

  it('blocks upgrade after three upgrades on a unit type', () => {
    const upgraded = [
      createCombatUnit('u1', 'warrior', playerId, 0.5, 0.88),
      createCombatUnit('u2', 'warrior', playerId, 0.6, 0.88),
    ];
    upgraded[0]!.level = 4;
    upgraded[1]!.level = 4;
    expect(isTurnActionValid('upgrade', 'warrior', upgraded, playerId)).toBe(false);
  });

  it('requires at least one unit to double', () => {
    expect(isTurnActionValid('double', 'warrior', units, playerId)).toBe(true);
    expect(isTurnActionValid('double', 'mage', units, playerId)).toBe(true);
    expect(isTurnActionValid('double', 'archer', units, playerId)).toBe(false);
  });

  it('always allows add for draft pool types', () => {
    expect(isTurnActionValid('add', 'archer', units, playerId, draft)).toBe(true);
    expect(isTurnActionValid('add', 'cleric', units, playerId, draft)).toBe(false);
  });
});
