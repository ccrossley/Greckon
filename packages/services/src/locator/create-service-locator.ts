import type { AppPart, ServiceLocator } from './types.js';

type Entry = { part: AppPart; factory: () => unknown };

export function createServiceLocator(): ServiceLocator {
  const entries = new Map<symbol, Entry>();

  return {
    register(part, token, factory) {
      entries.set(token, { part, factory });
    },
    resolve<T>(part: AppPart, token: symbol) {
      const entry = entries.get(token);
      if (!entry) {
        const label = token.description ?? String(token);
        throw new Error(`Service not registered: ${label}`);
      }
      if (entry.part !== part) {
        throw new Error(`Service registered for different part`);
      }
      return entry.factory() as T;
    },
  };
}
