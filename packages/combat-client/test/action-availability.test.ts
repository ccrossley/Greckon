import { describe, expect, it } from 'vitest';
import { runActionPhase } from '../src/combat/action-phase.js';

describe('action phase', () => {
  it('picks one squad action per step', async () => {
    const actions = await runActionPhase(
      [
        { unitId: 'squad', actionId: 'upgrade:warrior', label: 'Upgrade Warrior' },
        { unitId: 'squad', actionId: 'add:archer', label: 'Add Archer' },
        { unitId: 'squad', actionId: 'double:warrior', label: 'Double Warrior' },
      ],
      1000,
      0,
      'bot-player',
      1,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]?.unitId).toBe('squad');
  });
});
