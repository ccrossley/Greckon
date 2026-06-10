import { WebSocket } from 'ws';
import type { MatchAssignment } from './battle/match-runner.js';
import { scheduleMatch } from './ws/client-gateway-server.js';

export interface CombatServerConfig {
  lobbyWsUrl: string;
  serverId: string;
  clientWsPort: number;
  reconnectTimeoutSeconds: number;
}

export interface LobbyConnection {
  connected: boolean;
  disconnect(): void;
  notifyMatchComplete(matchId: string, winnerPlayerId: string): void;
}

export function connectToLobby(
  config: CombatServerConfig,
  onAssignMatch: (assignment: MatchAssignment) => void = scheduleMatch,
): LobbyConnection {
  let socket: WebSocket | null = null;
  let connected = false;
  let reconnectTimer: NodeJS.Timeout | undefined;
  const startedAt = Date.now();

  const connect = () => {
    socket = new WebSocket(config.lobbyWsUrl);
    socket.on('open', () => {
      connected = true;
      socket?.send(
        JSON.stringify({
          type: 'RegisterServer',
          serverId: config.serverId,
          host: process.env.GRECKON_HOST ?? 'localhost',
          clientWsPort: config.clientWsPort,
          capacity: 2,
        }),
      );
      console.log(`[combat-server] registered with lobby as ${config.serverId}`);
    });
    socket.on('close', () => {
      connected = false;
      scheduleReconnect();
    });
    socket.on('error', () => {
      connected = false;
    });
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(String(data)) as {
          type?: string;
          matchId?: string;
          players?: MatchAssignment['players'];
        };
        if (message.type === 'AssignMatch' && message.matchId && message.players) {
          console.log(`[combat-server] assigned match ${message.matchId}`);
          onAssignMatch({ matchId: message.matchId, players: message.players });
        }
      } catch {
        // ignore
      }
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      if (elapsedSeconds >= config.reconnectTimeoutSeconds) {
        console.error('[combat-server] lobby reconnect timeout exceeded, exiting');
        clearInterval(reconnectTimer);
        process.exit(1);
      }
      if (!connected) {
        connect();
      }
    }, 1000);
  };

  connect();

  return {
    get connected() {
      return connected;
    },
    disconnect() {
      clearInterval(reconnectTimer);
      socket?.close();
      socket = null;
      connected = false;
    },
    notifyMatchComplete(matchId, winnerPlayerId) {
      if (!socket || socket.readyState !== socket.OPEN) {
        return;
      }
      socket.send(
        JSON.stringify({
          type: 'MatchComplete',
          matchId,
          winnerPlayerId,
        }),
      );
    },
  };
}
