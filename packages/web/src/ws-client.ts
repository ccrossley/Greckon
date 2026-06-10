import type { NetworkMessage } from '@greckon/core';

export class BrowserWsClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<(message: NetworkMessage) => void>();
  private inbox: NetworkMessage[] = [];

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private dispatch(message: NetworkMessage): void {
    this.inbox.push(message);
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  private takeFromInbox(type: NetworkMessage['type']): NetworkMessage | undefined {
    const index = this.inbox.findIndex((message) => message.type === type);
    if (index < 0) {
      return undefined;
    }
    return this.inbox.splice(index, 1)[0];
  }

  private takeOneOfFromInbox(types: NetworkMessage['type'][]): NetworkMessage | undefined {
    const index = this.inbox.findIndex((message) => types.includes(message.type));
    if (index < 0) {
      return undefined;
    }
    return this.inbox.splice(index, 1)[0];
  }

  connect(url: string, token: string): Promise<void> {
    const target = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    return new Promise((resolve, reject) => {
      this.inbox = [];
      this.socket = new WebSocket(target);
      this.socket.onopen = () => resolve();
      this.socket.onerror = () => reject(new Error('WebSocket connection failed'));
      this.socket.onmessage = (event) => {
        try {
          this.dispatch(JSON.parse(String(event.data)) as NetworkMessage);
        } catch {
          // ignore malformed payloads
        }
      };
    });
  }

  send(message: NetworkMessage): void {
    if (!this.connected) {
      throw new Error('WebSocket is not connected');
    }
    this.socket!.send(JSON.stringify(message));
  }

  onMessage(handler: (message: NetworkMessage) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  waitForMessage<T extends NetworkMessage['type']>(
    type: T,
    timeoutMs: number,
  ): Promise<Extract<NetworkMessage, { type: T }>> {
    const existing = this.takeFromInbox(type);
    if (existing) {
      return Promise.resolve(existing as Extract<NetworkMessage, { type: T }>);
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(
        () => {
          unsubscribe();
          reject(new Error(`timeout waiting for ${type}`));
        },
        timeoutMs,
      );
      const unsubscribe = this.onMessage((message) => {
        if (message.type === type) {
          window.clearTimeout(timer);
          unsubscribe();
          this.takeFromInbox(type);
          resolve(message as Extract<NetworkMessage, { type: T }>);
        }
      });
    });
  }

  waitForOneOf(types: NetworkMessage['type'][], timeoutMs: number): Promise<NetworkMessage> {
    const existing = this.takeOneOfFromInbox(types);
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(
        () => {
          unsubscribe();
          reject(new Error(`timeout waiting for ${types.join('|')}`));
        },
        timeoutMs,
      );
      const unsubscribe = this.onMessage((message) => {
        if (types.includes(message.type)) {
          window.clearTimeout(timer);
          unsubscribe();
          this.takeOneOfFromInbox(types);
          resolve(message);
        }
      });
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.listeners.clear();
    this.inbox = [];
  }
}
