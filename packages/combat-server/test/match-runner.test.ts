import { describe, expect, it, vi } from 'vitest';
import { runMatch, type MatchAssignment, type MatchGateway } from '../src/index.js';
import { routeClientMessage } from '../src/ws/message-router.js';

describe('match runner', () => {
  const assignment: MatchAssignment = {
    matchId: 'match-1',
    players: [
      { playerId: 'p1', username: 'alice', token: 't1' },
      { playerId: 'p2', username: 'bob', token: 't2' },
    ],
  };

  function createGateway(): MatchGateway {
    return {
      sendToPlayer(playerId, message) {
        const payload = message as Record<string, unknown>;
        if (payload.type === 'RequestUnitPick') {
          const available = payload.availableUnitTypes as string[];
          routeClientMessage(playerId, {
            type: 'UnitPick',
            pickPhase: payload.pickPhase,
            pickIndex: payload.pickIndex,
            unitType: available[0] ?? 'warrior',
          });
        }
        if (payload.type === 'RequestAction') {
          const available = payload.availableActions as Array<{ actionId: string; unitId: string }>;
          const pickCount = (payload.pickCount as number | undefined) ?? 3;
          routeClientMessage(playerId, {
            type: 'ActionSubmit',
            turnIndex: payload.turnIndex,
            actions: available.slice(0, pickCount).map((action) => ({
              unitId: action.unitId,
              actionId: action.actionId,
            })),
          });
        }
      },
      onComplete: vi.fn(),
    };
  }

  it('runs unit pick, action, and playback phases until a winner', async () => {
    const result = await runMatch(assignment, createGateway(), {
      fightPlaybackSeconds: 0,
      postDraftPauseSeconds: 0,
      turnWindowSeconds: 0,
      actionSelectionSeconds: 0,
      maxRounds: 3,
    });
    expect(result.winnerPlayerId).toBeTruthy();
    expect(result.finalRoundWins.playerA + result.finalRoundWins.playerB).toBeGreaterThan(0);
  }, 15000);

  it('respects turn deadline from config', async () => {
    const start = Date.now();
    await runMatch(assignment, createGateway(), {
      fightPlaybackSeconds: 0,
      postDraftPauseSeconds: 0,
      turnWindowSeconds: 0,
      actionSelectionSeconds: 0,
      maxRounds: 2,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  }, 15000);
});
