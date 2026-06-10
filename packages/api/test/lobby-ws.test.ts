import { describe, expect, it } from 'vitest';
import type { NetworkMessage } from '@greckon/core';
import { broadcastLobby } from '../src/index.js';

describe('lobby websocket messages', () => {
  const messages: NetworkMessage[] = [
    {
      type: 'MatchFound',
      matchId: 'm1',
      combatWsUrl: 'ws://localhost:4001',
      opponent: { playerId: 'p2', username: 'opponent' },
    },
    { type: 'ServerShutdown', reason: 'shutdown', reconnectAfterMs: 3000 },
  ];

  it.each(messages)('broadcast accepts valid $type payload', (message) => {
    expect(() => broadcastLobby(message as never)).not.toThrow();
  });
});
