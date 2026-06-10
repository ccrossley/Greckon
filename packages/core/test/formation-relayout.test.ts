import type { CombatUnit } from '../src/types/domain.js';
import { createCombatUnit, relayoutPlayerFormation } from '../src/index.js';
import { describe, expect, it } from 'vitest';

describe('formation relayout playback', () => {
  it('emits move events when units shift in formation', () => {
    const units: CombatUnit[] = [
      createCombatUnit('p-u1', 'warrior', 'p1', 0.49, 0.88),
      createCombatUnit('p-u2', 'warrior', 'p1', 0.51, 0.88),
    ];
    const playback = [];
    relayoutPlayerFormation(units, 'p1', true, playback, 0);

    expect(playback.every((event) => event.kind === 'move')).toBe(true);
    expect(playback.length).toBeGreaterThan(0);
    for (const event of playback) {
      expect(event.sourceUnitId).toBeDefined();
      expect(event.x).toBeDefined();
      expect(event.y).toBeDefined();
    }
  });
});
