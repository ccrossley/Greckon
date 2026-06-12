import { describe, expect, it } from 'vitest';
import {
  createAuthService,
  createLobbyService,
  finishMatch,
  getMatch,
  matchmakeWithBot,
} from '../src/index.js';
import { markPlayerConnected, clearLobbyConnections } from '../src/ws/lobby-socket.js';

describe('lobby', () => {
  it('join assigns a queue position', async () => {
    clearLobbyConnections();
    const auth = createAuthService();
    const lobby = createLobbyService();
    const session = await auth.login('alice');
    const result = await lobby.join(session.playerId, session.token, 'genoc_fantasy');
    expect(result.queuePosition).toBeGreaterThanOrEqual(1);
    expect(result.lobbyWsUrl).toMatch(/^ws/);
  });

  it('does not match until a human connects to lobby websocket', async () => {
    clearLobbyConnections();
    const auth = createAuthService();
    const lobby = createLobbyService();
    const session = await auth.login('alice');
    await lobby.join(session.playerId, session.token, 'genoc_fantasy');
    expect(matchmakeWithBot()).toBeNull();
  });

  it('allows re-joining the queue after a match finishes', async () => {
    clearLobbyConnections();
    const auth = createAuthService();
    const lobby = createLobbyService();
    const session = await auth.login('alice');
    await lobby.join(session.playerId, session.token, 'genoc_fantasy');
    markPlayerConnected(session.playerId);
    const matchId = matchmakeWithBot();
    expect(matchId).toBeTruthy();

    finishMatch(matchId!);
    expect(getMatch(matchId!)).toBeUndefined();

    const again = await lobby.join(session.playerId, session.token, 'the_croak');
    expect(again.queuePosition).toBeGreaterThanOrEqual(1);
    markPlayerConnected(session.playerId);
    expect(matchmakeWithBot()).toBeTruthy();
  });

  it('pairs a connected human with a bot opponent', async () => {
    clearLobbyConnections();
    const auth = createAuthService();
    const lobby = createLobbyService();
    const session = await auth.login('alice');
    await lobby.join(session.playerId, session.token, 'genoc_fantasy');
    markPlayerConnected(session.playerId);
    const matchId = matchmakeWithBot();
    expect(matchId).toBeTruthy();
  });
});
