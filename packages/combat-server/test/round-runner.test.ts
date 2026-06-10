import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '@greckon/core';
import { runRound } from '../src/index.js';

describe('round runner', () => {
  it('tracks best-of maxRounds round wins', async () => {
    const roundWins = { playerA: 0, playerB: 0 };
    for (let round = 1; round <= DEFAULT_GAME_CONFIG.maxRounds; round++) {
      const result = await runRound('match-1', round, roundWins);
      if (result.winnerPlayerId === 'p1') {
        roundWins.playerA++;
      } else if (result.winnerPlayerId === 'p2') {
        roundWins.playerB++;
      }
    }
    expect(roundWins.playerA + roundWins.playerB).toBeGreaterThan(0);
    expect(Math.max(roundWins.playerA, roundWins.playerB)).toBeLessThanOrEqual(
      Math.ceil(DEFAULT_GAME_CONFIG.maxRounds / 2),
    );
  });
});
