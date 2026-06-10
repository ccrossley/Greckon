import { describe, expect, it } from 'vitest';
import { runUnitPickPhase } from '../src/combat/unit-pick-phase.js';
import { listUnitTypes } from '@greckon/core';

describe('unit pick phase', () => {
  it('picks a unit type from the available list', async () => {
    const available = listUnitTypes();
    const pick = await runUnitPickPhase(available, 1, 'bot-player');
    expect(available).toContain(pick);
  });

  it('varies picks across indices', async () => {
    const available = listUnitTypes();
    const picks = await Promise.all([
      runUnitPickPhase(available, 1, 'bot-player'),
      runUnitPickPhase(available, 2, 'bot-player'),
      runUnitPickPhase(available, 3, 'bot-player'),
    ]);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });
});
