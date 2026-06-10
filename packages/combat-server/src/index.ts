export { runMatch, type MatchAssignment, type MatchResult } from './battle/match-runner.js';
export {
  processTurn,
  runRound,
  type TurnInput,
  type TurnOutcome,
} from './battle/round-runner.js';
export {
  connectToLobby,
  type CombatServerConfig,
  type LobbyConnection,
} from './lobby-connection.js';
export {
  handleClientMessage,
  promptActions,
  promptUnitPick,
} from './ws/client-gateway.js';
export {
  createClientGateway,
  setMatchCompleteHandler,
  startClientGateway,
  type ClientGatewayHandle,
} from './ws/client-gateway-server.js';
export { startEmbeddedCombat, type EmbeddedCombatHandle } from './embedded.js';

import type { CombatServerConfig } from './lobby-connection.js';
import { connectToLobby } from './lobby-connection.js';
import { setMatchCompleteHandler, startClientGateway } from './ws/client-gateway-server.js';

export async function bootstrap(config: CombatServerConfig): Promise<void> {
  const lobby = connectToLobby(config);
  setMatchCompleteHandler((matchId, winnerPlayerId) => {
    lobby.notifyMatchComplete(matchId, winnerPlayerId);
  });
  const gateway = startClientGateway(config.clientWsPort);
  console.log(`[combat-server] client WS ws://localhost:${config.clientWsPort}`);

  const shutdown = async (signal: string) => {
    console.log(`[combat-server] received ${signal}, shutting down...`);
    lobby.disconnect();
    await gateway.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await new Promise<void>(() => {
    // keep process alive until signal
  });
}
