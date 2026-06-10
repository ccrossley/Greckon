import { randomUUID } from 'node:crypto';
import { connectToLobby, type LobbyConnection } from './lobby-connection.js';
import { createClientGateway, setMatchCompleteHandler, type ClientGatewayHandle } from './ws/client-gateway-server.js';

export interface EmbeddedCombatHandle {
  serverId: string;
  lobby: LobbyConnection;
  gateway: ClientGatewayHandle;
  close(): Promise<void>;
}

export function startEmbeddedCombat(options: {
  registryWsUrl: string;
  publicHost: string;
  clientWsPort: number;
  reconnectTimeoutSeconds: number;
  serverId?: string;
}): EmbeddedCombatHandle {
  const serverId = options.serverId ?? randomUUID();
  const lobby = connectToLobby({
    lobbyWsUrl: options.registryWsUrl,
    serverId,
    clientWsPort: options.clientWsPort,
    reconnectTimeoutSeconds: options.reconnectTimeoutSeconds,
  });
  setMatchCompleteHandler((matchId, winnerPlayerId) => {
    lobby.notifyMatchComplete(matchId, winnerPlayerId);
  });
  const gateway = createClientGateway();

  return {
    serverId,
    lobby,
    gateway,
    async close() {
      lobby.disconnect();
      await gateway.close();
    },
  };
}
