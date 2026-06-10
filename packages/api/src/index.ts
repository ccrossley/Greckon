import type { MatchId, NetworkMessage, PlayerId } from '@greckon/core';
import { createAuthService, type AuthService } from './auth.js';
import {
  createLobbyService,
  finishMatch,
  getMatch,
  matchmake,
  matchmakeWithBot,
  type LobbyService,
} from './lobby/index.js';
import {
  killAllCombatServers,
  spawnCombatServer,
  type CombatServerHandle,
  type SpawnOptions,
} from './spawn/combat-server-spawner.js';
import { shutdownApi } from './shutdown.js';
import { assignMatchToCombatServer } from './ws/combat-registry.js';
import { broadcastLobby } from './ws/lobby-socket.js';

export interface ApiConfig {
  httpPort: number;
  lobbyWsPath: string;
  combatRegistryWsPath: string;
}

export interface ApiServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export { createApiServer } from './server/create-api-server.js';

export {
  assignMatchToCombatServer,
  broadcastLobby,
  createAuthService,
  createLobbyService,
  finishMatch,
  getMatch,
  killAllCombatServers,
  matchmake,
  matchmakeWithBot,
  shutdownApi,
  spawnCombatServer,
};

export type { AuthService } from './auth.js';
export type { LobbyService } from './lobby/index.js';
export type { CombatServerHandle, SpawnOptions } from './spawn/combat-server-spawner.js';

export type LobbyClientMessage = Extract<
  NetworkMessage,
  { type: 'QueueUpdate' | 'MatchFound' | 'ServerShutdown' | 'Ping' | 'Pong' }
>;
