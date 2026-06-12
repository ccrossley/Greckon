import { describe, expect, it } from 'vitest';
import {
  decodeNetworkMessage,
  encodeNetworkMessage,
  type NetworkMessage,
} from '../src/index.js';

const sampleMessages: NetworkMessage[] = [
  { type: 'QueueUpdate', queuePosition: 1 },
  {
    type: 'MatchFound',
    matchId: 'match-1',
    combatWsUrl: 'ws://localhost:4001',
    opponent: { playerId: 'p2', username: 'bob', factionId: 'genoc_fantasy' },
  },
  { type: 'ServerShutdown', reason: 'maintenance', reconnectAfterMs: 5000 },
  { type: 'Ping' },
  { type: 'Pong' },
  {
    type: 'RequestUnitPick',
    pickPhase: 'round_deploy',
    pickIndex: 1,
    deadlineMs: 10000,
    availableUnitTypes: ['warrior', 'mage'],
  },
  { type: 'UnitPick', pickPhase: 'round_deploy', pickIndex: 1, unitType: 'warrior' },
  {
    type: 'RequestAction',
    turnIndex: 0,
    pickIndex: 1,
    deadlineMs: 10000,
    pickCount: 3,
    availableActions: [{ unitId: 'squad', actionId: 'upgrade:warrior', label: 'Upgrade Warrior' }],
  },
  {
    type: 'ActionSubmit',
    turnIndex: 0,
    pickIndex: 1,
    actions: [{ unitId: 'squad', actionId: 'upgrade:warrior' }],
  },
  {
    type: 'TurnOutcome',
    turnIndex: 0,
    fightStartMs: 0,
    playback: [{ atMs: 0, description: 'Warrior strikes', kind: 'attack', durationMs: 500 }],
    roundScore: { playerA: 1, playerB: 0 },
    fieldAtFightStart: [
      {
        unitId: 'p1-u1',
        unitType: 'warrior',
        playerId: 'p1',
        hp: 20,
        maxHp: 20,
        level: 1,
        priority: 0,
        x: 0.5,
        y: 0.88,
        attack: 10,
        defense: 8,
        speed: 10,
        ngonSides: 6,
        attackRange: 0.08,
        attackType: 'instant',
        attackDelayMs: 800,
        travelTimeMs: 0,
        movementType: 'walk',
      },
    ],
  },
  {
    type: 'RoundResult',
    round: 1,
    winnerPlayerId: 'p1',
    roundWins: { playerA: 1, playerB: 0 },
  },
  {
    type: 'MatchResult',
    winnerPlayerId: 'p1',
    finalRoundWins: { playerA: 6, playerB: 4 },
  },
];

describe('message codec', () => {
  it.each(sampleMessages)('round-trips $type', (message) => {
    const encoded = encodeNetworkMessage(message);
    expect(encoded.type).toBe(message.type);
    const decoded = decodeNetworkMessage(message.type, encoded.payload);
    expect(decoded).toEqual(message);
  });
});
