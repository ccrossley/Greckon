import type { GameConfig } from '@greckon/core';
import {
  availableDraftUnitTypes,
  buildPlayerTurnActions,
  initRapier,
  isDraftUnitTypeAvailable,
  layoutAllFormations,
  listUnitTypesForFaction,
  loadGameConfig,
  pickBotTurnAction,
  pickRandomUnitType,
  type CombatUnit,
  type FactionId,
  type MatchId,
  type PlayerId,
  type UnitType,
} from '@greckon/core';
import {
  appendPlayerPick,
  prepareFieldForNextRound,
  processTurn,
  resetUnitCounter,
  type TurnInput,
} from './round-runner.js';
import { clearMessageInbox, waitForAllClientMessages } from '../ws/message-router.js';

export interface MatchAssignment {
  matchId: MatchId;
  players: Array<{ playerId: PlayerId; username: string; token: string; factionId: FactionId }>;
}

export interface MatchResult {
  matchId: MatchId;
  winnerPlayerId: PlayerId;
  finalRoundWins: { playerA: number; playerB: number };
}

export interface MatchGateway {
  sendToPlayer(playerId: PlayerId, message: unknown): void;
  onComplete(winnerPlayerId: PlayerId): void;
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendGameState(
  gateway: MatchGateway,
  players: MatchAssignment['players'],
  matchId: MatchId,
  round: number,
  roundWins: { playerA: number; playerB: number },
  phase: string,
  aliveUnits: CombatUnit[],
  options: { ownDraftByPlayer?: Record<PlayerId, UnitType[]> } = {},
): void {
  for (const player of players) {
    gateway.sendToPlayer(player.playerId, {
      type: 'GameState',
      matchId,
      round,
      roundWins,
      phase,
      aliveUnits: options.ownDraftByPlayer ? [] : aliveUnits,
      ownDraft: options.ownDraftByPlayer?.[player.playerId],
    });
  }
}

async function runSecretDraftPhase(
  assignment: MatchAssignment,
  gateway: MatchGateway,
  config: GameConfig,
  draftPool: Record<PlayerId, UnitType[]>,
): Promise<void> {
  const pickTimeoutMs = config.actionSelectionSeconds * 1000 + 500;

  for (let pickIndex = 1; pickIndex <= config.secretDraftPickCount; pickIndex++) {
    for (const player of assignment.players) {
      const unitTypes = listUnitTypesForFaction(player.factionId);
      const available = availableDraftUnitTypes(unitTypes, draftPool[player.playerId]!);
      gateway.sendToPlayer(player.playerId, {
        type: 'RequestUnitPick',
        pickPhase: 'secret_draft',
        pickIndex,
        deadlineMs: config.actionSelectionSeconds * 1000,
        availableUnitTypes: available,
      });
    }

    let responses: Record<string, unknown>[] = [];
    try {
      responses = await waitForAllClientMessages(
        assignment.players.map((player) => ({ playerId: player.playerId, type: 'UnitPick' })),
        pickTimeoutMs,
      );
    } catch {
      responses = [];
    }

    for (let index = 0; index < assignment.players.length; index++) {
      const player = assignment.players[index]!;
      const response = responses[index];
      const alreadyPicked = draftPool[player.playerId]!;
      const unitTypes = listUnitTypesForFaction(player.factionId);
      const available = availableDraftUnitTypes(unitTypes, alreadyPicked);
      const submitted = response?.unitType as UnitType | undefined;
      const unitType =
        submitted &&
        isDraftUnitTypeAvailable(submitted, alreadyPicked) &&
        unitTypes.includes(submitted)
          ? submitted
          : pickRandomUnitType(available, pickIndex, player.playerId);
      draftPool[player.playerId]!.push(unitType);
    }

    sendGameState(
      gateway,
      assignment.players,
      assignment.matchId,
      0,
      { playerA: 0, playerB: 0 },
      'secret_draft',
      [],
      { ownDraftByPlayer: draftPool },
    );
  }
}

function spawnFieldFromDraft(
  draftPool: Record<PlayerId, UnitType[]>,
  playerAId: PlayerId,
  playerBId: PlayerId,
): CombatUnit[] {
  resetUnitCounter();
  const fieldUnits: CombatUnit[] = [];

  for (const playerId of Object.keys(draftPool)) {
    const isBottom = playerId === playerAId;
    for (const unitType of draftPool[playerId]!) {
      appendPlayerPick(fieldUnits, playerId, unitType, isBottom);
    }
  }

  layoutAllFormations(fieldUnits, playerAId, playerBId);
  return fieldUnits;
}

export async function runMatch(
  assignment: MatchAssignment,
  gateway: MatchGateway,
  configOverrides: Partial<GameConfig> = {},
): Promise<MatchResult> {
  clearMessageInbox();
  const config = loadGameConfig(configOverrides);
  await initRapier();
  const [playerA, playerB] = assignment.players;
  const draftPool: Record<PlayerId, UnitType[]> = {
    [playerA.playerId]: [],
    [playerB.playerId]: [],
  };

  await runSecretDraftPhase(assignment, gateway, config, draftPool);

  await waitMs(config.postDraftPauseSeconds * 1000);

  const fieldUnits = spawnFieldFromDraft(draftPool, playerA.playerId, playerB.playerId);

  sendGameState(
    gateway,
    assignment.players,
    assignment.matchId,
    1,
    { playerA: 0, playerB: 0 },
    'draft_reveal',
    fieldUnits,
  );

  const roundWins = { playerA: 0, playerB: 0 };
  let winnerPlayerId: PlayerId | null = null;
  const majority = Math.ceil(config.maxRounds / 2);

  for (let round = 1; round <= config.maxRounds; round++) {
    layoutAllFormations(fieldUnits, playerA.playerId, playerB.playerId);
    sendGameState(
      gateway,
      assignment.players,
      assignment.matchId,
      round,
      roundWins,
      'action_selection',
      fieldUnits,
    );

    const turnIndex = round - 1;
    const collectedByPlayer = new Map<PlayerId, TurnInput['actions']>(
      assignment.players.map((player) => [player.playerId, []]),
    );

    for (let pickStep = 1; pickStep <= config.roundActionPickCount; pickStep++) {
      const offersByPlayer = new Map<PlayerId, ReturnType<typeof buildPlayerTurnActions>>();

      for (const player of assignment.players) {
        const availableActions = buildPlayerTurnActions(
          turnIndex,
          player.playerId,
          fieldUnits,
          draftPool[player.playerId]!,
          config.roundActionOfferCount,
          pickStep,
        );
        offersByPlayer.set(player.playerId, availableActions);
        gateway.sendToPlayer(player.playerId, {
          type: 'RequestAction',
          turnIndex,
          pickIndex: pickStep,
          deadlineMs: config.turnWindowSeconds * 1000,
          pickCount: config.roundActionPickCount,
          availableActions,
        });
      }

      const actionTimeoutMs = config.turnWindowSeconds * 1000 + 500;
      let responses: Record<string, unknown>[] = [];
      try {
        responses = await waitForAllClientMessages(
          assignment.players.map((player) => ({ playerId: player.playerId, type: 'ActionSubmit' })),
          actionTimeoutMs,
        );
      } catch {
        responses = [];
      }

      for (let index = 0; index < assignment.players.length; index++) {
        const player = assignment.players[index]!;
        const response = responses[index];
        const availableActions = offersByPlayer.get(player.playerId) ?? [];
        const availableIds = new Set(availableActions.map((action) => action.actionId));
        const collected = collectedByPlayer.get(player.playerId) ?? [];

        let picked: TurnInput['actions'][number] | null = null;
        const submittedTurn = response?.turnIndex;
        const submittedPickIndex = response?.pickIndex;
        if (
          response &&
          submittedTurn === turnIndex &&
          submittedPickIndex === pickStep &&
          Array.isArray(response.actions)
        ) {
          const action = response.actions[0] as TurnInput['actions'][number] | undefined;
          if (action && availableIds.has(action.actionId)) {
            picked = action;
          }
        }

        if (!picked) {
          const fallback = pickBotTurnAction(availableActions, turnIndex, `${player.playerId}:${pickStep}`);
          if (fallback) {
            picked = { unitId: fallback.unitId, actionId: fallback.actionId };
          }
        }

        if (picked) {
          collected.push(picked);
          collectedByPlayer.set(player.playerId, collected);
        }
      }
    }

    const turnInputs: TurnInput[] = assignment.players.map((player) => ({
      playerId: player.playerId,
      turnIndex,
      actions: collectedByPlayer.get(player.playerId) ?? [],
    }));

    const outcome = await processTurn(
      fieldUnits,
      turnInputs,
      playerA.playerId,
      playerB.playerId,
      draftPool,
    );

    sendGameState(
      gateway,
      assignment.players,
      assignment.matchId,
      round,
      roundWins,
      'fight_playback',
      outcome.fieldAtFightStart,
    );

    for (const player of assignment.players) {
      gateway.sendToPlayer(player.playerId, { type: 'TurnOutcome', ...outcome });
    }

    const roundWinner =
      outcome.roundScore.playerA > outcome.roundScore.playerB
        ? playerA.playerId
        : outcome.roundScore.playerB > outcome.roundScore.playerA
          ? playerB.playerId
          : playerA.playerId;
    if (roundWinner === playerA.playerId) {
      roundWins.playerA++;
    } else {
      roundWins.playerB++;
    }

    const nextFieldUnits = prepareFieldForNextRound(
      outcome.unitsAfterActions,
      outcome.survivors,
      playerA.playerId,
      playerB.playerId,
    );
    fieldUnits.splice(0, fieldUnits.length, ...nextFieldUnits);

    sendGameState(
      gateway,
      assignment.players,
      assignment.matchId,
      round,
      roundWins,
      'round_end',
      fieldUnits,
    );

    for (const player of assignment.players) {
      gateway.sendToPlayer(player.playerId, {
        type: 'RoundResult',
        round,
        winnerPlayerId: roundWinner,
        roundWins: { ...roundWins },
      });
    }

    if (roundWins.playerA >= majority || roundWins.playerB >= majority) {
      winnerPlayerId = roundWins.playerA >= roundWins.playerB ? playerA.playerId : playerB.playerId;
      break;
    }

    await waitMs(config.fightPlaybackSeconds * 1000);
  }

  if (!winnerPlayerId) {
    winnerPlayerId =
      roundWins.playerA >= roundWins.playerB ? playerA.playerId : playerB.playerId;
  }

  const result: MatchResult = {
    matchId: assignment.matchId,
    winnerPlayerId,
    finalRoundWins: roundWins,
  };

  for (const player of assignment.players) {
    gateway.sendToPlayer(player.playerId, {
      type: 'MatchResult',
      winnerPlayerId,
      finalRoundWins: roundWins,
    });
  }

  gateway.onComplete(winnerPlayerId);
  return result;
}
