import { WebSocket } from 'ws';
import type { NetworkMessage } from '@greckon/core';

export interface CombatWsClient {
  connected: boolean;
  connect(url: string, token: string): Promise<void>;
  send(message: NetworkMessage): void;
  onMessage(handler: (message: NetworkMessage) => void): void;
  disconnect(): void;
}

export function createCombatWsClient(): CombatWsClient {
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
            messageHandler?.(JSON.parse(String(data)) as NetworkMessage);
          } catch {
            // ignore
          }
        });
      });
    },
    send(message) {
      socket?.send(JSON.stringify(message));
    },
    onMessage(handler) {
      messageHandler = handler;
    },
    disconnect() {
      socket?.close();
      socket = null;
    },
  };
}
