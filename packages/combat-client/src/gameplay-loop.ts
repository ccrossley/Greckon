import { DEFAULT_GAME_CONFIG, loadGameConfig } from '@greckon/core';
import { runCombatSession } from './combat/combat-session.js';
import { createHttpClient } from './net/http-client.js';
import { createLobbyWsClient } from './net/lobby-ws.js';
import {
  createClientStateMachine,
  type ClientScreen,
  type ClientStateMachine,
} from './state/client-state-machine.js';

export async function runGameplayLoop(
  username: string,
  machine = createClientStateMachine(loadGameConfig()),
): Promise<ClientScreen> {
  const config = loadGameConfig();
  const baseUrl = process.env.GRECKON_API_URL ?? 'http://localhost:3000';
  const http = createHttpClient(baseUrl);
  const lobbyWs = createLobbyWsClient();

  machine.setScreen('login');
  const session = await http.login(username);
  machine.setScreen('lobby');
  const lobby = await http.joinLobby(session.token);
  console.log(`[client] waiting in lobby (queue ${lobby.queuePosition}) — match starts when connected`);

  const matchPromise = new Promise<{ combatWsUrl: string }>((resolve, reject) => {
    lobbyWs.onMessage((message) => {
      if (message.type === 'MatchFound') {
        console.log(`[client] matched vs ${message.opponent.username}`);
        resolve({ combatWsUrl: message.combatWsUrl });
      }
      if (message.type === 'ServerShutdown') {
        reject(new Error(message.reason));
      }
      if (message.type === 'QueueUpdate') {
        console.log(`[client] queue position ${message.queuePosition}`);
      }
    });
  });

  await lobbyWs.connect(lobby.lobbyWsUrl, session.token);
  console.log('[client] connected to lobby — waiting for opponent');

  try {
    const { combatWsUrl } = await matchPromise;
    lobbyWs.disconnect();
    await runCombatSession(combatWsUrl, session.token, { config, machine });
    machine.setScreen('lobby');
    return 'lobby';
  } catch (error) {
    machine.onDisconnected('lobby');
    if (machine.screen === 'loading') {
      await machine.tick();
    }
    return machine.screen;
  }
}

export { DEFAULT_GAME_CONFIG };
