import { describe, expect, it } from 'vitest';
import { runActionPhase } from '../src/combat/action-phase.js';

describe('action phase', () => {
  it('picks up to the configured number of squad actions', async () => {
    const actions = await runActionPhase(
      [
        { unitId: 'squad', actionId: 'upgrade:warrior', label: 'Upgrade Warrior' },
        { unitId: 'squad', actionId: 'add:archer', label: 'Add Archer' },
        { unitId: 'squad', actionId: 'double:warrior', label: 'Double Warrior' },
      ],
      1000,
      0,
      'bot-player',
      3,
    );
    expect(actions).toHaveLength(3);
    expect(actions[0]).toEqual({ unitId: 'squad', actionId: 'upgrade:warrior' });
  });
});
