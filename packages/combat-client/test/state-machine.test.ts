import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '@greckon/core';
import { createClientStateMachine } from '../src/index.js';

describe('client state machine', () => {
  it('transitions to loading when lobby disconnects', () => {
    const machine = createClientStateMachine(DEFAULT_GAME_CONFIG);
    machine.onDisconnected('lobby');
    expect(machine.screen).toBe('loading');
  });

  it('transitions to loading when combat disconnects', () => {
    const machine = createClientStateMachine(DEFAULT_GAME_CONFIG);
    machine.onDisconnected('combat');
    expect(machine.screen).toBe('loading');
  });

  it('retries lobby connection at configured interval while loading', async () => {
    vi.useFakeTimers();
    const machine = createClientStateMachine(DEFAULT_GAME_CONFIG);
    machine.onDisconnected('lobby');
    const tickPromise = machine.tick();
    await vi.advanceTimersByTimeAsync(DEFAULT_GAME_CONFIG.lobbyReconnectIntervalMs);
    await tickPromise;
    expect(machine.screen).toBe('lobby');
    vi.useRealTimers();
  });

  it('tracks combat screen states with round metadata', () => {
    const machine = createClientStateMachine(DEFAULT_GAME_CONFIG);
    machine.setScreen('combat_action_selection', { round: 3, turnIndex: 1 });
    expect(machine.screen).toBe('combat_action_selection');
    expect(machine.round).toBe(3);
    expect(machine.turnIndex).toBe(1);
  });
});
