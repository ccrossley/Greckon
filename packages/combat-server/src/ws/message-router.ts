import type { PlayerId } from '@greckon/core';

type MessageHandler = (playerId: PlayerId, message: Record<string, unknown>) => void;

const inbox = new Map<PlayerId, Record<string, unknown>[]>();
let messageHandler: MessageHandler | null = null;

export function clearMessageInbox(): void {
  inbox.clear();
  messageHandler = null;
}

export function setMatchMessageHandler(handler: MessageHandler | null): void {
  messageHandler = handler;
}

export function routeClientMessage(
  playerId: PlayerId,
  message: Record<string, unknown>,
): void {
  const queue = inbox.get(playerId) ?? [];
  queue.push(message);
  inbox.set(playerId, queue);
  messageHandler?.(playerId, message);
}

export function takeClientMessage(
  playerId: PlayerId,
  type: string,
): Record<string, unknown> | undefined {
  const queue = inbox.get(playerId) ?? [];
  const index = queue.findIndex((entry) => entry.type === type);
  if (index < 0) {
    return undefined;
  }
  return queue.splice(index, 1)[0];
}

export function waitForAllClientMessages(
  waits: Array<{ playerId: PlayerId; type: string }>,
  timeoutMs: number,
): Promise<Record<string, unknown>[]> {
  const pending = new Set(waits.map((wait) => `${wait.playerId}:${wait.type}`));
  const results = new Map<string, Record<string, unknown>>();

  for (const wait of waits) {
    const existing = takeClientMessage(wait.playerId, wait.type);
    if (existing) {
      const key = `${wait.playerId}:${wait.type}`;
      results.set(key, existing);
      pending.delete(key);
    }
  }

  if (pending.size === 0) {
    return Promise.resolve(waits.map((wait) => results.get(`${wait.playerId}:${wait.type}`)!));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      setMatchMessageHandler(null);
      reject(new Error(`timeout waiting for ${[...pending].join(', ')}`));
    }, timeoutMs);

    setMatchMessageHandler((fromPlayerId, message) => {
      for (const wait of waits) {
        const key = `${wait.playerId}:${wait.type}`;
        if (!pending.has(key) || fromPlayerId !== wait.playerId || message.type !== wait.type) {
          continue;
        }
        takeClientMessage(fromPlayerId, wait.type);
        results.set(key, message);
        pending.delete(key);
      }

      if (pending.size === 0) {
        clearTimeout(timer);
        setMatchMessageHandler(null);
        resolve(waits.map((wait) => results.get(`${wait.playerId}:${wait.type}`)!));
      }
    });
  });
}

export function waitForClientMessage(
  playerId: PlayerId,
  type: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const existing = takeClientMessage(playerId, type);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      setMatchMessageHandler(null);
      reject(new Error(`timeout ${type} from ${playerId}`));
    }, timeoutMs);

    setMatchMessageHandler((fromPlayerId, message) => {
      if (fromPlayerId !== playerId || message.type !== type) {
        return;
      }
      clearTimeout(timer);
      setMatchMessageHandler(null);
      takeClientMessage(playerId, type);
      resolve(message);
    });
  });
}
