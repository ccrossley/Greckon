import { describe, expect, it } from 'vitest';
import { createAuthService } from '../src/index.js';

describe('auth', () => {
  it('login returns token and playerId', async () => {
    const auth = createAuthService();
    const session = await auth.login('alice');
    expect(session.token).toBeTruthy();
    expect(session.playerId).toBeTruthy();
    expect(session.username).toBe('alice');
  });

  it('logout invalidates token', async () => {
    const auth = createAuthService();
    const session = await auth.login('alice');
    await auth.logout(session.token);
    const me = await auth.getSession(session.token);
    expect(me).toBeNull();
  });

  it('getSession returns current player', async () => {
    const auth = createAuthService();
    const session = await auth.login('bob');
    const me = await auth.getSession(session.token);
    expect(me).toEqual({ playerId: session.playerId, username: 'bob' });
  });
});
