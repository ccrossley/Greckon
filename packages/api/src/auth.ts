import { randomUUID } from 'node:crypto';
import type { PlayerId } from '@greckon/core';

export interface Session {
  token: string;
  playerId: PlayerId;
  username: string;
}

const sessions = new Map<string, Session>();
const tokenToPlayerId = new Map<string, PlayerId>();

export interface AuthService {
  login(username: string): Promise<Session>;
  logout(token: string): Promise<void>;
  getSession(token: string): Promise<{ playerId: PlayerId; username: string } | null>;
}

export function createBotSession(username: string): Session {
  const playerId = randomUUID();
  const token = randomUUID();
  const session = { token, playerId, username };
  sessions.set(playerId, session);
  tokenToPlayerId.set(token, playerId);
  return session;
}

export function createAuthService(): AuthService {
  return {
    async login(username) {
      const playerId = randomUUID();
      const token = randomUUID();
      const session = { token, playerId, username };
      sessions.set(playerId, session);
      tokenToPlayerId.set(token, playerId);
      return session;
    },
    async logout(token) {
      const playerId = tokenToPlayerId.get(token);
      if (!playerId) {
        return;
      }
      tokenToPlayerId.delete(token);
      sessions.delete(playerId);
    },
    async getSession(token) {
      const playerId = tokenToPlayerId.get(token);
      if (!playerId) {
        return null;
      }
      const session = sessions.get(playerId);
      if (!session) {
        return null;
      }
      return { playerId: session.playerId, username: session.username };
    },
  };
}

export function getPlayerIdFromToken(token: string | undefined): PlayerId | null {
  if (!token) {
    return null;
  }
  const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;
  return tokenToPlayerId.get(bearer) ?? null;
}

export function getSessionRecord(playerId: PlayerId): Session | undefined {
  return sessions.get(playerId);
}
