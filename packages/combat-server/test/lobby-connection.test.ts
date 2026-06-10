import { describe, expect, it, vi } from 'vitest';
import { connectToLobby, type CombatServerConfig } from '../src/index.js';

describe('lobby connection', () => {
  const config: CombatServerConfig = {
    lobbyWsUrl: 'ws://localhost:3001/combat-registry',
    serverId: 'test-server',
    clientWsPort: 4001,
    reconnectTimeoutSeconds: 30,
  };

  it('reconnects for z seconds when lobby is disconnected', async () => {
    vi.useFakeTimers();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    connectToLobby(config);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(exitSpy).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });

  it('returns a connected lobby connection when lobby is available', () => {
    const connection = connectToLobby(config);
    expect(connection.connected).toBe(true);
  });
});
