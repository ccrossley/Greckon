import type { FactionId, PlayerId } from '@greckon/core';

export interface HttpClient {
  login(username: string): Promise<{ token: string; playerId: PlayerId; username: string }>;
  joinLobby(token: string, factionId: FactionId): Promise<{ lobbyWsUrl: string; queuePosition: number }>;
}

export function createHttpClient(baseUrl: string): HttpClient {
  return {
    async login(username) {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) {
        throw new Error(`login failed: ${response.status}`);
      }
      return (await response.json()) as {
        token: string;
        playerId: PlayerId;
        username: string;
      };
    },
    async joinLobby(token, factionId) {
      const response = await fetch(`${baseUrl}/lobby/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ factionId }),
      });
      if (!response.ok) {
        throw new Error(`join lobby failed: ${response.status}`);
      }
      return (await response.json()) as { lobbyWsUrl: string; queuePosition: number };
    },
  };
}
