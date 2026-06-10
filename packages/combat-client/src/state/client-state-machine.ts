import type { GameConfig } from '@greckon/core';
import type { ClientScreen } from './screens.js';

export type { ClientScreen } from './screens.js';
export { COMBAT_SCREENS, isCombatScreen } from './screens.js';

export interface ClientStateMachine {
  screen: ClientScreen;
  round: number;
  turnIndex: number;
  tick(): Promise<void>;
  setScreen(screen: ClientScreen, meta?: { round?: number; turnIndex?: number }): void;
  onDisconnected(from: 'lobby' | 'combat'): void;
}

export function createClientStateMachine(config: GameConfig): ClientStateMachine {
  let screen: ClientScreen = 'login';
  let round = 0;
  let turnIndex = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const logScreen = (next: ClientScreen) => {
    const suffix =
      round > 0 ? ` round=${round}${turnIndex > 0 ? ` turn=${turnIndex}` : ''}` : '';
    console.log(`[screen] ${next}${suffix}`);
  };

  return {
    get screen() {
      return screen;
    },
    get round() {
      return round;
    },
    get turnIndex() {
      return turnIndex;
    },
    setScreen(next, meta = {}) {
      screen = next;
      if (meta.round !== undefined) {
        round = meta.round;
      }
      if (meta.turnIndex !== undefined) {
        turnIndex = meta.turnIndex;
      }
      logScreen(next);
    },
    async tick() {
      if (screen !== 'loading') {
        return;
      }
      await new Promise<void>((resolve) => {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        reconnectTimer = setTimeout(() => {
          screen = 'lobby';
          logScreen('lobby');
          resolve();
        }, config.lobbyReconnectIntervalMs);
      });
    },
    onDisconnected(_from) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      screen = 'loading';
      logScreen('loading');
    },
  };
}
