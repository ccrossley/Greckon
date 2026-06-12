import { describe, expect, it } from 'vitest';
import { UNITS, UNIT_CATALOG } from '../src/generated/units.js';
import { getUnitDefinition, getUnitDisplayName, listUnitTypes } from '../src/game-data/unit-catalog.js';

describe('unit catalog', () => {
  it('loads all 12 units', () => {
    expect(UNITS).toHaveLength(36);
    expect(listUnitTypes()).toHaveLength(36);
  });

  it('maps JSON fields into runtime definitions', () => {
    const archer = getUnitDefinition('archer');
    expect(archer.name).toBe('Archer');
    expect(archer.addAmount).toBe(2);
    expect(archer.attackType).toBe('line');
    expect(archer.movementType).toBe('float');
    expect(archer.ngonSides).toBe(UNIT_CATALOG.archer.sides);
  });

  it('uses catalog display names', () => {
    expect(getUnitDisplayName('warrior')).toBe('Warrior');
  });
});
