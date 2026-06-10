import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { loadGameConfig } from '@greckon/core';
import type { MatchAssignment } from '../battle/match-runner.js';
import { runMatch } from '../battle/match-runner.js';
import { routeClientMessage } from './message-router.js';

interface ConnectedPlayer {
  playerId: string;
  username: string;
  token: string;
  socket: WebSocket;
}

let pendingAssignment: MatchAssignment | null = null;
const connectedPlayers = new Map<string, ConnectedPlayer>();
let activeMatch: Promise<void> | null = null;
let onMatchComplete: ((matchId: string, winnerPlayerId: string) => void) | undefined;

export function setMatchCompleteHandler(
  handler: (matchId: string, winnerPlayerId: string) => void,
): void {
  onMatchComplete = handler;
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function sendToPlayer(playerId: string, message: unknown): void {
  const player = connectedPlayers.get(playerId);
  if (player) {
    send(player.socket, message);
  }
}

function tryStartMatch(): void {
  if (!pendingAssignment || activeMatch) {
    return;
  }
  const expected = pendingAssignment.players.map((player) => player.playerId);
  if (!expected.every((playerId) => connectedPlayers.has(playerId))) {
    return;
  }

  const assignment = pendingAssignment;
  pendingAssignment = null;
  activeMatch = runMatch(assignment, {
    sendToPlayer,
    onComplete(winnerPlayerId) {
      console.log(`[combat-server] match ${assignment.matchId} complete winner=${winnerPlayerId}`);
      activeMatch = null;
      connectedPlayers.clear();
      onMatchComplete?.(assignment.matchId, winnerPlayerId);
    },
  }).then(() => undefined);
}

export function scheduleMatch(assignment: MatchAssignment): void {
  pendingAssignment = assignment;
  console.log(`[combat-server] match scheduled ${assignment.matchId}`);
  tryStartMatch();
}

function attachGatewayHandlers(wss: WebSocketServer): void {
  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token || !pendingAssignment) {
      socket.close();
      return;
    }

    const player = pendingAssignment.players.find((entry) => entry.token === token);
    if (!player) {
      socket.close();
      return;
    }

    connectedPlayers.set(player.playerId, { ...player, socket });
    console.log(`[combat-server] client connected ${player.username}`);

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(String(data)) as Record<string, unknown>;
        console.log(`[combat-server] ${player.username} -> ${message.type ?? 'unknown'}`);
        routeClientMessage(player.playerId, message);
      } catch {
        // ignore
      }
    });

    socket.on('close', () => {
      connectedPlayers.delete(player.playerId);
    });

    tryStartMatch();
  });
}

export interface ClientGatewayHandle {
  wss: WebSocketServer;
  close(): Promise<void>;
}

export function createClientGateway(): ClientGatewayHandle {
  const wss = new WebSocketServer({ noServer: true });
  attachGatewayHandlers(wss);
  return {
    wss,
    close() {
      return new Promise((resolve, reject) => {
        wss.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

export function startClientGateway(port: number): ClientGatewayHandle & { port: number } {
  const config = loadGameConfig();
  const httpServer = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('greckon combat-server');
  });
  const wss = new WebSocketServer({ server: httpServer });
  attachGatewayHandlers(wss);

  httpServer.listen(port);
  console.log(
    `[combat-server] gateway on :${port} (turn=${config.turnWindowSeconds}s maxRounds=${config.maxRounds})`,
  );

  return {
    wss,
    port,
    close() {
      return new Promise((resolve, reject) => {
        wss.close(() => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      });
    },
  };
}

export function resetGatewayForTests(): void {
  pendingAssignment = null;
  connectedPlayers.clear();
  activeMatch = null;
  onMatchComplete = undefined;
}
