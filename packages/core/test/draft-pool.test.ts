import { describe, expect, it } from 'vitest';
import {
  availableDraftUnitTypes,
  isDraftUnitTypeAvailable,
  listUnitTypes,
} from '../src/index.js';

describe('draft pool', () => {
  it('excludes already picked unit types', () => {
    const all = listUnitTypes();
    const available = availableDraftUnitTypes(all, ['warrior', 'rogue']);
    expect(available).not.toContain('warrior');
    expect(available).not.toContain('rogue');
    expect(available.length).toBe(all.length - 2);
  });

  it('rejects duplicate submissions', () => {
    expect(isDraftUnitTypeAvailable('warrior', ['warrior'])).toBe(false);
    expect(isDraftUnitTypeAvailable('mage', ['warrior'])).toBe(true);
  });
});
