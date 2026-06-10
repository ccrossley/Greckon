import { describe, expect, it } from 'vitest';
import { createUnitCatalog } from '../src/units/catalog.js';

describe('createUnitCatalog', () => {
  it('lists compiled unit types', () => {
    const catalog = createUnitCatalog();
    expect(catalog.listUnitTypes()).toHaveLength(12);
    expect(catalog.getUnitDisplayName('healer')).toBe('Healer');
    expect(catalog.getUnitDefinition('healer').movementType).toBe('float');
  });
});
