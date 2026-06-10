import { killAllCombatServers } from './spawn/combat-server-spawner.js';
import { broadcastLobby } from './ws/lobby-socket.js';

export function shutdownApi(): Promise<void> {
  broadcastLobby({ type: 'ServerShutdown', reason: 'shutdown' });
  return killAllCombatServers();
}
