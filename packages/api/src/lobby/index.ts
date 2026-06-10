import { randomUUID } from 'node:crypto';
import type { MatchId, PlayerId } from '@greckon/core';
import { isPlayerConnected } from '../ws/lobby-socket.js';
import { createBotSession } from '../auth.js';

export const BOT_USERNAME = process.env.GRECKON_BOT_USERNAME ?? 'opponent';

export interface QueuedPlayer {
  playerId: PlayerId;
  token: string;
  username: string;
  isBot?: boolean;
}

export interface MatchRecord {
  matchId: MatchId;
  players: [QueuedPlayer, QueuedPlayer];
  combatWsUrl?: string;
  combatServerId?: string;
}

const queue: QueuedPlayer[] = [];
const matches = new Map<MatchId, MatchRecord>();
const playerQueueIndex = new Map<PlayerId, number>();
const playerMatch = new Map<PlayerId, MatchId>();

export interface LobbyService {
  join(playerId: PlayerId, token: string): Promise<{ lobbyWsUrl: string; queuePosition: number }>;
  leave(playerId: PlayerId): Promise<void>;
  getStatus(playerId: PlayerId): Promise<{
    inQueue: boolean;
    matchId?: MatchId;
    combatWsUrl?: string;
    combatServerId?: string;
  }>;
}

export function createLobbyService(
  getLobbyWsUrl: () => string = () => 'ws://localhost:3000/lobby',
): LobbyService {
  return {
    async join(playerId, token) {
      const { getSessionRecord } = await import('../auth.js');
      const session = getSessionRecord(playerId);
      if (!session) {
        throw new Error('Unknown player');
      }
      if (playerMatch.has(playerId)) {
        const staleMatchId = playerMatch.get(playerId);
        if (staleMatchId) {
          finishMatch(staleMatchId);
        } else {
          playerMatch.delete(playerId);
        }
      }
      if (!playerQueueIndex.has(playerId)) {
        queue.push({ playerId, token, username: session.username });
        queue.forEach((entry, index) => playerQueueIndex.set(entry.playerId, index + 1));
      }
      return {
        lobbyWsUrl: getLobbyWsUrl(),
        queuePosition: playerQueueIndex.get(playerId) ?? queue.length,
      };
    },
    async leave(playerId) {
      const index = queue.findIndex((entry) => entry.playerId === playerId);
      if (index >= 0) {
        queue.splice(index, 1);
        playerQueueIndex.delete(playerId);
        queue.forEach((entry, idx) => playerQueueIndex.set(entry.playerId, idx + 1));
      }
    },
    async getStatus(playerId) {
      const matchId = playerMatch.get(playerId);
      if (matchId) {
        const match = matches.get(matchId);
        return {
          inQueue: false,
          matchId,
          combatWsUrl: match?.combatWsUrl,
          combatServerId: match?.combatServerId,
        };
      }
      return { inQueue: playerQueueIndex.has(playerId) };
    },
  };
}

export function getReadyHumanInQueue(): QueuedPlayer | null {
  return queue.find((entry) => !entry.isBot && isPlayerConnected(entry.playerId)) ?? null;
}

export function matchmakeWithBot(): MatchId | null {
  const human = getReadyHumanInQueue();
  if (!human) {
    return null;
  }

  const humanIndex = queue.findIndex((entry) => entry.playerId === human.playerId);
  if (humanIndex < 0) {
    return null;
  }
  queue.splice(humanIndex, 1);
  playerQueueIndex.delete(human.playerId);
  queue.forEach((entry, idx) => playerQueueIndex.set(entry.playerId, idx + 1));

  const botSession = createBotSession(BOT_USERNAME);
  const bot: QueuedPlayer = {
    playerId: botSession.playerId,
    token: botSession.token,
    username: botSession.username,
    isBot: true,
  };

  const matchId = randomUUID();
  const record: MatchRecord = { matchId, players: [human, bot] };
  matches.set(matchId, record);
  playerMatch.set(human.playerId, matchId);
  playerMatch.set(bot.playerId, matchId);
  return matchId;
}

/** @deprecated Use matchmakeWithBot — requires a connected human in queue. */
export function matchmake(): MatchId | null {
  if (queue.length < 2) {
    return null;
  }
  const playerA = queue.shift()!;
  const playerB = queue.shift()!;
  playerQueueIndex.delete(playerA.playerId);
  playerQueueIndex.delete(playerB.playerId);
  queue.forEach((entry, idx) => playerQueueIndex.set(entry.playerId, idx + 1));

  const matchId = randomUUID();
  const record: MatchRecord = { matchId, players: [playerA, playerB] };
  matches.set(matchId, record);
  playerMatch.set(playerA.playerId, matchId);
  playerMatch.set(playerB.playerId, matchId);
  return matchId;
}

export function getMatch(matchId: MatchId): MatchRecord | undefined {
  return matches.get(matchId);
}

export function setMatchCombatInfo(
  matchId: MatchId,
  combatWsUrl: string,
  combatServerId: string,
): void {
  const match = matches.get(matchId);
  if (!match) {
    return;
  }
  match.combatWsUrl = combatWsUrl;
  match.combatServerId = combatServerId;
}

export function getQueuePosition(playerId: PlayerId): number {
  return playerQueueIndex.get(playerId) ?? 1;
}

export function clearPlayerFromMatch(playerId: PlayerId): void {
  playerMatch.delete(playerId);
}

/** Release players after a match ends so they can join the queue again. */
export function finishMatch(matchId: MatchId): void {
  const record = matches.get(matchId);
  if (!record) {
    return;
  }
  for (const player of record.players) {
    playerMatch.delete(player.playerId);
  }
  matches.delete(matchId);
}

export function getBotFromMatch(matchId: MatchId): QueuedPlayer | undefined {
  return getMatch(matchId)?.players.find((player) => player.isBot);
}

export function getHumanFromMatch(matchId: MatchId): QueuedPlayer | undefined {
  return getMatch(matchId)?.players.find((player) => !player.isBot);
}
