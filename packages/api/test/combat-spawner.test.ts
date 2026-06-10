import { describe, expect, it, vi } from 'vitest';
import {
  killAllCombatServers,
  shutdownApi,
  spawnCombatServer,
} from '../src/index.js';

describe('combat server spawner', () => {
  it('spawn passes lobby WS url to child process env', () => {
    const spawnSpy = vi.spyOn(process, 'env', 'get').mockReturnValue({
      ...process.env,
      GRECKON_LOBBY_WS_URL: 'ws://localhost:3001/combat-registry',
    });
    const handle = spawnCombatServer();
    expect(handle.pid).toBeGreaterThan(0);
    expect(handle.serverId).toBeTruthy();
    spawnSpy.mockRestore();
  });

  it('shutdown kills all combat server processes', async () => {
    spawnCombatServer();
    await expect(shutdownApi()).resolves.toBeUndefined();
    await expect(killAllCombatServers()).resolves.toBeUndefined();
  });
});
