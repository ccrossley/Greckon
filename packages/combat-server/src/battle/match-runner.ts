import type { GameConfig } from '@greckon/core';
import {
  availableDraftUnitTypes,
  buildPlayerTurnActions,
  initRapier,
  isDraftUnitTypeAvailable,
  layoutAllFormations,
  listUnitTypes,
  loadGameConfig,
  pickBotTurnActions,
  pickRandomUnitType,
  type CombatUnit,
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
  players: Array<{ playerId: PlayerId; username: string; token: string }>;
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
  const unitTypes = listUnitTypes();
  const pickTimeoutMs = config.actionSelectionSeconds * 1000 + 500;

  for (let pickIndex = 1; pickIndex <= config.secretDraftPickCount; pickIndex++) {
    for (const player of assignment.players) {
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
      const available = availableDraftUnitTypes(unitTypes, alreadyPicked);
      const submitted = response?.unitType as UnitType | undefined;
      const unitType =
        submitted && isDraftUnitTypeAvailable(submitted, alreadyPicked)
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
    const turnInputs: TurnInput[] = [];
    const actionsByPlayer = new Map<PlayerId, ReturnType<typeof buildPlayerTurnActions>>();

    for (const player of assignment.players) {
      const availableActions = buildPlayerTurnActions(
        turnIndex,
        player.playerId,
        fieldUnits,
        draftPool[player.playerId]!,
        config.roundActionOfferCount,
      );
      actionsByPlayer.set(player.playerId, availableActions);
      gateway.sendToPlayer(player.playerId, {
        type: 'RequestAction',
        turnIndex,
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
      const availableActions = actionsByPlayer.get(player.playerId) ?? [];
      const submittedTurn = response?.turnIndex;
      if (response && submittedTurn === turnIndex) {
        const availableIds = new Set(availableActions.map((action) => action.actionId));
        const seen = new Set<string>();
        const actions: TurnInput['actions'] = [];
        for (const action of (response.actions as TurnInput['actions']) ?? []) {
          if (actions.length >= config.roundActionPickCount) {
            break;
          }
          if (!availableIds.has(action.actionId) || seen.has(action.actionId)) {
            continue;
          }
          seen.add(action.actionId);
          actions.push(action);
        }
        if (actions.length > 0) {
          turnInputs.push({
            playerId: player.playerId,
            turnIndex,
            actions,
          });
          continue;
        }
      }
      const fallback = pickBotTurnActions(
        availableActions,
        turnIndex,
        player.playerId,
        config.roundActionPickCount,
      );
      turnInputs.push({
        playerId: player.playerId,
        turnIndex,
        actions: fallback.map((action) => ({
          unitId: action.unitId,
          actionId: action.actionId,
        })),
      });
    }

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
