import { describe, expect, it } from 'vitest';
import { createCombatUnit, getUnitDefinition, listUnitTypes } from '../src/index.js';

describe('unit definitions', () => {
  it('lists known unit types', () => {
    const types = listUnitTypes();
    expect(types).toContain('healer');
    expect(types).toHaveLength(36);
  });

  it('returns stats for a known unit type', () => {
    const warrior = getUnitDefinition('warrior');
    expect(warrior.unitType).toBe('warrior');
    expect(warrior.maxHp).toBeGreaterThan(0);
    expect(warrior.ngonSides).toBe(14);
    expect(warrior.attackType).toBe('instant');
    expect(warrior.movementType).toBe('charge');
  });

  it('throws for an unknown unit type', () => {
    expect(() => getUnitDefinition('unknown' as never)).toThrow(/unknown/i);
  });

  it('creates combat units with catalog combat fields', () => {
    const mage = createCombatUnit('m1', 'mage', 'p1', 0.5, 0.5);
    expect(mage.attackType).toBe('projectile');
    expect(mage.travelTimeMs).toBe(350);
    expect(mage.attackRange).toBe(0.16);
  });
});
