import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_COMBAT_TUNING,
  getCombatTuning,
  loadCombatTuning,
  loadGameConfig,
  maxSimMs,
  simStepMs,
} from '../src/index.js';

describe('combat tuning config', () => {
  afterEach(() => {
    loadCombatTuning();
  });

  it('exposes documented defaults', () => {
    expect(DEFAULT_COMBAT_TUNING.movement.hop.intervalMs).toBe(450);
    expect(DEFAULT_COMBAT_TUNING.movement.float.amplitude).toBe(0.011);
    expect(DEFAULT_COMBAT_TUNING.playback.hop.visualHeight).toBe(0.052);
    expect(DEFAULT_COMBAT_TUNING.playback.unitPresence.enterMs).toBe(350);
    expect(DEFAULT_COMBAT_TUNING.playback.unitPresence.exitMs).toBe(350);
    expect(maxSimMs()).toBe(50 * 1800);
    expect(simStepMs()).toBe(250);
  });

  it('merges partial overrides via loadCombatTuning', () => {
    loadCombatTuning({
      playback: { hop: { visualHeight: 0.08 } },
    });
    expect(getCombatTuning().playback.hop.visualHeight).toBe(0.08);
    expect(getCombatTuning().movement.hop.intervalMs).toBe(450);
  });

  it('applies combatTuning overrides from loadGameConfig', () => {
    loadGameConfig({
      combatTuning: {
        movement: { charge: { impactDamageScale: 1.5 } },
      },
    });
    expect(getCombatTuning().movement.charge.impactDamageScale).toBe(1.5);
  });
});
