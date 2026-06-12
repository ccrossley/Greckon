import { describe, expect, it } from 'vitest';
import { assignMatchToCombatServer, matchmakeWithBot, spawnCombatServer } from '../../src/index.js';
import { createAuthService, createLobbyService } from '../../src/index.js';
import { markPlayerConnected, clearLobbyConnections } from '../../src/ws/lobby-socket.js';

describe('match flow integration', () => {
  it('assigns a bot match to a spawned combat server when human is connected', async () => {
    clearLobbyConnections();
    const auth = createAuthService();
    const lobby = createLobbyService();
    const session = await auth.login('alice');
    await lobby.join(session.playerId, session.token, 'koala_horde');
    markPlayerConnected(session.playerId);

    const handle = spawnCombatServer();
    const matchId = matchmakeWithBot();
    expect(matchId).toBeTruthy();
    expect(() => assignMatchToCombatServer(matchId!, handle.serverId)).not.toThrow();
    await handle.kill();
  });
});
