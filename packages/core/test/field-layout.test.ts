import { describe, expect, it } from 'vitest';
import {
  chunkUnitsIntoRows,
  createCombatUnit,
  FIELD_X_MAX,
  FIELD_X_MIN,
  getUnitRowPriority,
  layoutPlayerFormation,
  rowFitsInField,
} from '../src/index.js';

describe('field layout', () => {
  it('sorts melee before ranged and higher power before lower', () => {
    expect(getUnitRowPriority('warrior')).toBeLessThan(getUnitRowPriority('rogue'));
    expect(getUnitRowPriority('rogue')).toBeLessThan(getUnitRowPriority('archer'));
  });

  it('groups units of the same type on one row', () => {
    const units = [
      createCombatUnit('a1', 'rogue', 'p1', 0, 0.88),
      createCombatUnit('a2', 'warrior', 'p1', 0, 0.88),
      createCombatUnit('a3', 'rogue', 'p1', 0, 0.88),
      createCombatUnit('a4', 'archer', 'p1', 0, 0.88),
    ];
    layoutPlayerFormation(units, 'p1', true);
    const rogues = units.filter((unit) => unit.unitType === 'rogue');
    expect(rogues[0]!.y).toBe(rogues[1]!.y);
    expect(rogues[0]!.x).not.toBe(rogues[1]!.x);
    expect(units.find((unit) => unit.unitType === 'warrior')!.y).toBeLessThan(rogues[0]!.y);
    expect(units.find((unit) => unit.unitType === 'archer')!.y).toBeGreaterThan(rogues[0]!.y);
  });

  it('wraps overflowing unit counts into additional rows', () => {
    const units = Array.from({ length: 36 }, (_, index) =>
      createCombatUnit(`w${index}`, 'warrior', 'p1', 0, 0.88, 4),
    );
    const rows = chunkUnitsIntoRows(units);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row) => rowFitsInField(row))).toBe(true);
    expect(rows.flat()).toHaveLength(units.length);

    layoutPlayerFormation(units, 'p1', true);
    for (const unit of units) {
      expect(unit.x).toBeGreaterThanOrEqual(FIELD_X_MIN);
      expect(unit.x).toBeLessThanOrEqual(FIELD_X_MAX);
    }
    const rowYs = [...new Set(units.map((unit) => unit.y))];
    expect(rowYs.length).toBeGreaterThan(1);
  });

  it('orders stronger units before weaker units in a row', () => {
    const weak = createCombatUnit('a-low', 'warrior', 'p1', 0, 0.88, 1);
    const strong = createCombatUnit('a-high', 'warrior', 'p1', 0, 0.88, 4);
    layoutPlayerFormation([weak, strong], 'p1', true);
    expect(strong.x).toBeLessThan(weak.x);
  });
});
