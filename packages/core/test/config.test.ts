import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, loadGameConfig } from '../src/index.js';

describe('game config', () => {
  it('exposes documented defaults', () => {
    expect(DEFAULT_GAME_CONFIG.turnWindowSeconds).toBe(10);
    expect(DEFAULT_GAME_CONFIG.fightPlaybackSeconds).toBe(12);
    expect(DEFAULT_GAME_CONFIG.secretDraftPickCount).toBe(4);
    expect(DEFAULT_GAME_CONFIG.postDraftPauseSeconds).toBe(1);
    expect(DEFAULT_GAME_CONFIG.roundActionPickCount).toBe(3);
    expect(DEFAULT_GAME_CONFIG.roundActionOfferCount).toBe(3);
    expect(DEFAULT_GAME_CONFIG.roundUnitPickCount).toBe(3);
    expect(DEFAULT_GAME_CONFIG.unitPickCount).toBe(3);
    expect(DEFAULT_GAME_CONFIG.lobbyReconnectIntervalMs).toBe(3000);
    expect(DEFAULT_GAME_CONFIG.combatServerLobbyReconnectTimeoutSeconds).toBe(30);
    expect(DEFAULT_GAME_CONFIG.maxRounds).toBe(10);
  });

  it('merges overrides via loadGameConfig', () => {
    const config = loadGameConfig({ turnWindowSeconds: 15 });
    expect(config.turnWindowSeconds).toBe(15);
    expect(config.unitPickCount).toBe(3);
    expect(config.roundUnitPickCount).toBe(3);
  });
});
