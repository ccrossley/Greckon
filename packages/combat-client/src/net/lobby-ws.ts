import { WebSocket } from 'ws';
import type { NetworkMessage } from '@greckon/core';

export interface LobbyWsClient {
  connected: boolean;
  connect(url: string, token: string): Promise<void>;
  disconnect(): void;
  onMessage(handler: (message: NetworkMessage) => void): void;
}

export function createLobbyWsClient(): LobbyWsClient {
  let socket: WebSocket | null = null;
  let messageHandler: ((message: NetworkMessage) => void) | undefined;

  return {
    get connected() {
      return socket?.readyState === WebSocket.OPEN;
    },
    connect(url, token) {
      const target = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
      return new Promise((resolve, reject) => {
        socket = new WebSocket(target);
        socket.on('open', () => resolve());
        socket.on('error', reject);
        socket.on('message', (data) => {
          try {
            const message = JSON.parse(String(data)) as NetworkMessage;
            messageHandler?.(message);
          } catch {
            // ignore
          }
        });
      });
    },
    disconnect() {
      socket?.close();
      socket = null;
    },
    onMessage(handler) {
      messageHandler = handler;
    },
  };
}
