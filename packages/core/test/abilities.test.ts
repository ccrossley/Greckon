import { beforeAll, describe, expect, it } from 'vitest';
import {
  createCombatUnit,
  getAbilityForUnit,
  initRapier,
  isSupportAbility,
  listAbilities,
  resolveAbilityTargets,
  runPhysicsSimulation,
} from '../src/index.js';

describe('ability catalog', () => {
  it('lists 36 unique abilities', () => {
    expect(listAbilities()).toHaveLength(36);
  });

  it('marks healers as support', () => {
    expect(isSupportAbility(getAbilityForUnit('healer'))).toBe(true);
    expect(isSupportAbility(getAbilityForUnit('warrior'))).toBe(false);
  });

  it('targets wounded allies for healers', () => {
    const healer = createCombatUnit('h1', 'healer', 'p1', 0.45, 0.8);
    const ally = createCombatUnit('a1', 'warrior', 'p1', 0.5, 0.8);
    ally.hp = 5;
    const enemy = createCombatUnit('e1', 'squire', 'p2', 0.5, 0.2);
    const ability = getAbilityForUnit('healer');
    const targets = resolveAbilityTargets(healer, ability, [healer, ally, enemy]);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.unitId).toBe('a1');
  });
});

describe('ability combat simulation', () => {
  beforeAll(async () => {
    await initRapier();
  });

  it('healers emit heal events instead of damaging enemies', async () => {
    const healer = createCombatUnit('h1', 'healer', 'p1', 0.45, 0.75);
    const ally = createCombatUnit('a1', 'warrior', 'p1', 0.5, 0.75);
    ally.hp = 10;
    const enemy = createCombatUnit('e1', 'squire', 'p2', 0.5, 0.25);
    const result = await runPhysicsSimulation([healer, ally, enemy], 'p1', 'p2', 100);
    expect(result.playback.some((event) => event.kind === 'heal')).toBe(true);
    expect(result.playback.some((event) => event.kind === 'attack' && event.sourceUnitId === 'h1')).toBe(
      false,
    );
    const healedAlly = result.survivors.find((unit) => unit.unitId === 'a1');
    expect(healedAlly && healedAlly.hp > 10).toBe(true);
  });

  it('rogues still deal attack damage', async () => {
    const rogue = createCombatUnit('r1', 'rogue', 'p1', 0.5, 0.75);
    const enemy = createCombatUnit('e1', 'healer', 'p2', 0.5, 0.25);
    const result = await runPhysicsSimulation([rogue, enemy], 'p1', 'p2', 100);
    expect(result.playback.some((event) => event.kind === 'attack' && event.sourceUnitId === 'r1')).toBe(
      true,
    );
  });

  it('mystics deal pierce-enhanced damage', async () => {
    const mystic = createCombatUnit('m1', 'mystic', 'p1', 0.5, 0.75);
    const enemy = createCombatUnit('e1', 'knight', 'p2', 0.5, 0.25);
    const result = await runPhysicsSimulation([mystic, enemy], 'p1', 'p2', 100);
    const attacks = result.playback.filter((event) => event.kind === 'attack' && event.sourceUnitId === 'm1');
    expect(attacks.length).toBeGreaterThan(0);
  });

  it('warlocks emit multi-target attacks', async () => {
    const warlock = createCombatUnit('w1', 'warlock', 'p1', 0.5, 0.75);
    const enemyA = createCombatUnit('e1', 'squire', 'p2', 0.4, 0.25);
    const enemyB = createCombatUnit('e2', 'scout', 'p2', 0.6, 0.25);
    const result = await runPhysicsSimulation([warlock, enemyA, enemyB], 'p1', 'p2', 100);
    const attacks = result.playback.filter(
      (event) => event.kind === 'attack' && event.sourceUnitId === 'w1' && event.attackType === 'multi',
    );
    expect(attacks.length).toBeGreaterThan(0);
  });
});
