import { describe, expect, it } from 'vitest';
import {
  getFaction,
  getFactionDisplayName,
  getFactionIdForUnit,
  isValidFactionId,
  listFactionIds,
  listFactions,
  listUnitTypesForFaction,
} from '../src/index.js';

describe('faction catalog', () => {
  it('lists all factions', () => {
    expect(listFactions()).toHaveLength(3);
    expect(listFactionIds()).toEqual(['genoc_fantasy', 'koala_horde', 'the_croak']);
  });

  it('resolves faction metadata', () => {
    expect(getFactionDisplayName('koala_horde')).toBe('Koala Horde');
    expect(getFaction('the_croak').emblemIcon).toBe('frog');
  });

  it('validates faction ids', () => {
    expect(isValidFactionId('genoc_fantasy')).toBe(true);
    expect(isValidFactionId('invalid')).toBe(false);
  });

  it('lists twelve units per faction', () => {
    for (const factionId of listFactionIds()) {
      expect(listUnitTypesForFaction(factionId)).toHaveLength(12);
    }
    expect(getFactionIdForUnit('healer')).toBe('genoc_fantasy');
    expect(getFactionIdForUnit('pond_mender')).toBe('the_croak');
    expect(listUnitTypesForFaction('koala_horde')).toContain('gumleaf_shaman');
  });
});
