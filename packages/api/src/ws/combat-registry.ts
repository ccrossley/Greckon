import type { WebSocket } from 'ws';
import type { MatchId } from '@greckon/core';
import { getMatch } from '../lobby/index.js';

interface RegisteredServer {
  serverId: string;
  host: string;
  clientWsPort: number;
  capacity: number;
  socket: WebSocket;
}

const servers = new Map<string, RegisteredServer>();
const matchAssignments = new Map<MatchId, string>();

export function registerCombatServer(
  serverId: string,
  host: string,
  clientWsPort: number,
  capacity: number,
  socket: WebSocket,
): void {
  servers.set(serverId, { serverId, host, clientWsPort, capacity, socket });
  socket.on('close', () => servers.delete(serverId));
  socket.send(JSON.stringify({ type: 'ServerRegistered', ok: true }));
}

export function assignMatchToCombatServer(matchId: MatchId, serverId: string): void {
  const server = servers.get(serverId);
  const match = getMatch(matchId);
  if (!server || !match) {
    return;
  }
  matchAssignments.set(matchId, serverId);
  server.socket.send(
    JSON.stringify({
      type: 'AssignMatch',
      matchId,
      players: match.players.map((player) => ({
        playerId: player.playerId,
        username: player.username,
        token: player.token,
        factionId: player.factionId,
      })),
    }),
  );
}

export function getCombatServer(serverId: string): RegisteredServer | undefined {
  return servers.get(serverId);
}

export function listCombatServerIds(): string[] {
  return [...servers.keys()];
}

export function getAssignedServerId(matchId: MatchId): string | undefined {
  return matchAssignments.get(matchId);
}

export function clearMatchAssignment(matchId: MatchId): void {
  matchAssignments.delete(matchId);
}
