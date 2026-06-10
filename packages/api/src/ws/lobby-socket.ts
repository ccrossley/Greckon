import type { WebSocket } from 'ws';
import type { NetworkMessage, PlayerId } from '@greckon/core';

type LobbyEvent = Extract<
  NetworkMessage,
  { type: 'QueueUpdate' | 'MatchFound' | 'ServerShutdown' | 'Ping' | 'Pong' }
>;

const lobbyClients = new Set<WebSocket>();
const playerSockets = new Map<PlayerId, WebSocket>();
const connectedPlayers = new Set<PlayerId>();

function send(socket: WebSocket, event: LobbyEvent): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

export function registerLobbyClient(socket: WebSocket, playerId: PlayerId): void {
  lobbyClients.add(socket);
  playerSockets.set(playerId, socket);
  connectedPlayers.add(playerId);

  socket.on('close', () => {
    lobbyClients.delete(socket);
    playerSockets.delete(playerId);
    connectedPlayers.delete(playerId);
  });
}

export function isPlayerConnected(playerId: PlayerId): boolean {
  return connectedPlayers.has(playerId);
}

export function sendLobbyToPlayer(playerId: PlayerId, event: LobbyEvent): void {
  const socket = playerSockets.get(playerId);
  if (socket) {
    send(socket, event);
  }
}

export function broadcastLobby(event: LobbyEvent): void {
  for (const client of lobbyClients) {
    send(client, event);
  }
}

export function getLobbyClientCount(): number {
  return lobbyClients.size;
}

/** Test helper */
export function markPlayerConnected(playerId: PlayerId): void {
  connectedPlayers.add(playerId);
}

/** Test helper */
export function clearLobbyConnections(): void {
  lobbyClients.clear();
  playerSockets.clear();
  connectedPlayers.clear();
}
