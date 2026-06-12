import {
  loadGameConfig,
  type NetworkMessage,
} from '@greckon/core';
import { runActionPhase } from './action-phase.js';
import { runPlaybackPhase } from './playback-phase.js';
import { runUnitPickPhase } from './unit-pick-phase.js';
import { createCombatWsClient } from '../net/combat-ws.js';
import type { ClientStateMachine } from '../state/client-state-machine.js';

function waitForMessage<T extends NetworkMessage['type']>(
  onMessage: (handler: (message: NetworkMessage) => void) => void,
  type: T,
  timeoutMs: number,
): Promise<Extract<NetworkMessage, { type: T }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
    onMessage((message) => {
      if (message.type === type) {
        clearTimeout(timer);
        resolve(message as Extract<NetworkMessage, { type: T }>);
      }
    });
  });
}

function waitForOneOfMessage(
  onMessage: (handler: (message: NetworkMessage) => void) => void,
  types: NetworkMessage['type'][],
  timeoutMs: number,
): Promise<NetworkMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${types.join('|')}`)),
      timeoutMs,
    );
    onMessage((message) => {
      if (types.includes(message.type)) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

export async function runCombatSession(
  combatWsUrl: string,
  token: string,
  options: {
    config?: ReturnType<typeof loadGameConfig>;
    machine?: ClientStateMachine;
    logPrefix?: string;
  } = {},
): Promise<void> {
  const config = options.config ?? loadGameConfig();
  const machine = options.machine;
  const prefix = options.logPrefix ?? '[client]';
  const combatWs = createCombatWsClient();
  const onMessage = (handler: (message: NetworkMessage) => void) => combatWs.onMessage(handler);
  const pickTimeoutMs = config.actionSelectionSeconds * 1000 + 5000;

  machine?.setScreen('combat_secret_draft');
  await combatWs.connect(combatWsUrl, token);
  console.log(`${prefix} connected to combat server`);

  for (let pickIndex = 0; pickIndex < config.secretDraftPickCount; pickIndex++) {
    const request = await waitForMessage(onMessage, 'RequestUnitPick', pickTimeoutMs);
    machine?.setScreen('combat_secret_draft', { round: 0, turnIndex: request.pickIndex });
    const unitType = await runUnitPickPhase(request.availableUnitTypes, request.pickIndex, token);
    combatWs.send({
      type: 'UnitPick',
      pickPhase: request.pickPhase,
      pickIndex: request.pickIndex,
      unitType,
    });
  }

  const roundTimeoutMs = config.turnWindowSeconds * 1000 + 5000;

  while (true) {
    const next = await waitForOneOfMessage(onMessage, ['RequestAction', 'MatchResult'], roundTimeoutMs);

    if (next.type === 'MatchResult') {
      machine?.setScreen('combat_match_end', { round: config.maxRounds, turnIndex: 0 });
      combatWs.disconnect();
      console.log(`${prefix} match complete`);
      return;
    }

    const actionRequest = next as Extract<NetworkMessage, { type: 'RequestAction' }>;
    const round = actionRequest.turnIndex + 1;
    machine?.setScreen('combat_action_selection', { round, turnIndex: actionRequest.turnIndex });
    const actions = await runActionPhase(
      actionRequest.availableActions,
      actionRequest.deadlineMs,
      actionRequest.turnIndex,
      token,
      actionRequest.pickIndex,
    );
    combatWs.send({
      type: 'ActionSubmit',
      turnIndex: actionRequest.turnIndex,
      pickIndex: actionRequest.pickIndex,
      actions,
    });

    machine?.setScreen('combat_fight_playback', { round, turnIndex: actionRequest.turnIndex });
    const outcome = await waitForMessage(
      onMessage,
      'TurnOutcome',
      config.fightPlaybackSeconds * 1000 + 5000,
    );
    await runPlaybackPhase(outcome, config.fightPlaybackSeconds);

    machine?.setScreen('combat_round_end', { round, turnIndex: actionRequest.turnIndex });
    await waitForMessage(onMessage, 'RoundResult', roundTimeoutMs);
  }
}
