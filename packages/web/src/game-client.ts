import { getUnitDisplayName, loadGameConfig, type CombatUnit, type NetworkMessage, type UnitType } from '@greckon/core';
import { BrowserWsClient } from './ws-client.js';
import type { GameUi } from './ui.js';

const USERNAME_KEY = 'greckon.username';

type GameStateMessage = Extract<NetworkMessage, { type: 'GameState' }>;

export function savedUsername(): string {
  return localStorage.getItem(USERNAME_KEY) ?? '';
}

export function rememberUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username);
}

export class GameClient {
  private readonly config = loadGameConfig();
  private readonly apiBase = window.location.origin;
  private fieldUnits: CombatUnit[] = [];
  private pendingGameStates: GameStateMessage[] = [];
  private suppressArenaSync = false;

  constructor(private readonly ui: GameUi) {}

  async start(username: string): Promise<void> {
    rememberUsername(username);
    this.ui.setScreen('login');
    this.ui.log(`Signing in as ${username}…`);

    const session = await this.login(username);
    this.ui.setScreen('lobby');
    this.ui.log('Joined queue — connecting to lobby…');

    const lobby = await this.joinLobby(session.token);
    const lobbyWs = new BrowserWsClient();

    const matchPromise = new Promise<{ combatWsUrl: string; opponent: string }>((resolve, reject) => {
      lobbyWs.onMessage((message) => {
        if (message.type === 'MatchFound') {
          resolve({
            combatWsUrl: message.combatWsUrl,
            opponent: message.opponent.username,
          });
        }
        if (message.type === 'ServerShutdown') {
          reject(new Error(message.reason));
        }
        if (message.type === 'QueueUpdate') {
          this.ui.showLobbyQueue(message.queuePosition);
        }
      });
    });

    await lobbyWs.connect(lobby.lobbyWsUrl, session.token);
    this.ui.showLobbyQueue(lobby.queuePosition);
    this.ui.log('Connected — waiting for opponent…');

    try {
      const { combatWsUrl, opponent } = await matchPromise;
      lobbyWs.disconnect();
      this.ui.log(`Matched vs ${opponent}`);
      await this.runCombat(combatWsUrl, session.token, session.playerId);
      this.ui.setScreen('lobby');
      this.ui.showPlayAgain(username);
    } catch (error) {
      this.ui.setScreen('loading');
      this.ui.log(error instanceof Error ? error.message : String(error));
      await this.ui.wait(this.config.lobbyReconnectIntervalMs);
      this.ui.showPlayAgain(username);
    }
  }

  private async login(username: string) {
    const response = await fetch(`${this.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      throw new Error(`Login failed (${response.status})`);
    }
    return (await response.json()) as { token: string; playerId: string; username: string };
  }

  private async joinLobby(token: string) {
    const response = await fetch(`${this.apiBase}/lobby/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Join lobby failed (${response.status})`);
    }
    return (await response.json()) as { lobbyWsUrl: string; queuePosition: number };
  }

  private applyFieldFromGameState(message: GameStateMessage): void {
    this.fieldUnits = message.aliveUnits.map((unit) => ({ ...unit }));
    if (message.phase === 'secret_draft') {
      this.ui.showSecretDraft(message.ownDraft ?? []);
      return;
    }
    this.syncArenaFromField(message.phase);
  }

  private handleGameState(message: GameStateMessage): void {
    if (message.phase === 'fight_playback') {
      this.ui.hideCombatWait();
      return;
    }

    if (this.ui.isPlaybackActive() || this.suppressArenaSync) {
      this.pendingGameStates.push(message);
      return;
    }

    this.applyFieldFromGameState(message);
  }

  private consumePendingPhase(phase: GameStateMessage['phase']): boolean {
    const index = this.pendingGameStates.findIndex((message) => message.phase === phase);
    if (index < 0) {
      return false;
    }
    const [message] = this.pendingGameStates.splice(index, 1);
    this.applyFieldFromGameState(message);
    return true;
  }

  private async ensureFieldPhase(
    combatWs: BrowserWsClient,
    phase: GameStateMessage['phase'],
    timeoutMs: number,
  ): Promise<void> {
    if (this.consumePendingPhase(phase)) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for field phase ${phase}`));
      }, timeoutMs);

      const unsubscribe = combatWs.onMessage((message) => {
        if (message.type !== 'GameState') {
          return;
        }
        this.handleGameState(message);
        if (this.consumePendingPhase(phase)) {
          window.clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private syncArenaFromField(phase: GameStateMessage['phase']): void {
    this.ui.showCombatField(this.fieldUnits);
    if (phase === 'unit_pick' || phase === 'draft_reveal') {
      this.ui.log(`Squad updated — ${this.fieldUnits.length} units on field`);
    } else if (phase === 'action_selection') {
      this.ui.log(`Round roster — ${this.fieldUnits.length} units on field`);
    } else if (phase === 'round_end') {
      this.ui.log(`Round ended — ${this.fieldUnits.length} units on field`);
    }
  }

  private async submitUnitPick(
    combatWs: BrowserWsClient,
    request: Extract<NetworkMessage, { type: 'RequestUnitPick' }>,
    playerId: string,
  ): Promise<void> {
    const screen = request.pickPhase === 'secret_draft' ? 'combat_secret_draft' : 'combat_unit_pick';
    this.ui.setScreen(screen, { pickIndex: request.pickIndex });
    const unitType = await this.ui.pickUnit(
      request.availableUnitTypes as UnitType[],
      request.pickIndex,
      request.deadlineMs,
      playerId,
      request.pickPhase,
    );
    combatWs.send({
      type: 'UnitPick',
      pickPhase: request.pickPhase,
      pickIndex: request.pickIndex,
      unitType,
    });
    this.ui.log(
      request.pickPhase === 'secret_draft'
        ? `Secret draft ${request.pickIndex}: ${unitType}`
        : `Deployed pick ${request.pickIndex}: ${unitType}`,
    );
  }

  private async runSecretDraft(
    combatWs: BrowserWsClient,
    playerId: string,
    pickTimeoutMs: number,
  ): Promise<void> {
    this.ui.setScreen('combat_secret_draft');
    this.ui.showSecretDraft([]);
    for (let pickIndex = 1; pickIndex <= this.config.secretDraftPickCount; pickIndex++) {
      const request = await combatWs.waitForMessage('RequestUnitPick', pickTimeoutMs);
      if (request.pickPhase !== 'secret_draft') {
        throw new Error(`Expected secret draft pick, got ${request.pickPhase}`);
      }
      await this.submitUnitPick(combatWs, request, playerId);
    }
  }

  private async waitForDraftReveal(
    combatWs: BrowserWsClient,
    pickTimeoutMs: number,
  ): Promise<void> {
    const expectedUnits = this.config.secretDraftPickCount * 2;
    if (this.fieldUnits.length >= expectedUnits) {
      this.ui.showCombatField(this.fieldUnits);
      return;
    }

    this.ui.showCombatWait('Draft complete — deploying squads…');

    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(new Error('Timed out waiting for draft reveal'));
      }, pickTimeoutMs);

      const unsubscribe = combatWs.onMessage((message) => {
        if (message.type !== 'GameState') {
          return;
        }
        this.handleGameState(message);
        if (
          (message.phase === 'draft_reveal' || message.phase === 'action_selection') &&
          this.fieldUnits.length >= expectedUnits
        ) {
          window.clearTimeout(timer);
          unsubscribe();
          this.ui.hideCombatWait();
          this.ui.showCombatField(this.fieldUnits);
          resolve();
        }
      });
    });
  }

  private async runCombat(combatWsUrl: string, token: string, playerId: string): Promise<void> {
    const combatWs = new BrowserWsClient();
    this.ui.setScreen('combat_unit_pick');
    this.ui.showCombatField([]);
    await combatWs.connect(combatWsUrl, token);
    this.ui.log('Connected to combat server');

    combatWs.onMessage((message) => {
      if (message.type === 'GameState') {
        this.handleGameState(message);
      }
    });

    const pickTimeoutMs = this.config.actionSelectionSeconds * 1000 + 5000;

    await this.runSecretDraft(combatWs, playerId, pickTimeoutMs);
    await this.waitForDraftReveal(combatWs, pickTimeoutMs);

    const roundTimeoutMs = this.config.turnWindowSeconds * 1000 + 5000;
    const outcomeTimeoutMs =
      (this.config.turnWindowSeconds + this.config.fightPlaybackSeconds) * 1000 + 15000;

    while (true) {
      const next = await combatWs.waitForOneOf(['RequestAction', 'MatchResult'], roundTimeoutMs);

      if (next.type === 'MatchResult') {
        this.ui.setScreen('combat_match_end');
        this.ui.showMatchResult(next);
        combatWs.disconnect();
        this.ui.log('Match complete');
        return;
      }

      const actionRequest = next as Extract<NetworkMessage, { type: 'RequestAction' }>;
      const round = actionRequest.turnIndex + 1;

      if (!this.consumePendingPhase('action_selection')) {
        await this.ensureFieldPhase(combatWs, 'action_selection', 5000).catch(() => undefined);
      }
      this.ui.showCombatField(this.fieldUnits);

      this.ui.setScreen('combat_action_selection', { round, turnIndex: actionRequest.turnIndex });
      const actions = await this.ui.pickActions(
        actionRequest.availableActions,
        actionRequest.deadlineMs,
        actionRequest.turnIndex,
        playerId,
        this.fieldUnits,
        actionRequest.pickCount,
      );
      combatWs.send({
        type: 'ActionSubmit',
        turnIndex: actionRequest.turnIndex,
        actions,
      });

      this.suppressArenaSync = true;
      this.pendingGameStates = [];
      this.ui.showCombatWait('Simulating turn…');
      this.ui.setScreen('combat_fight_playback', { round, turnIndex: actionRequest.turnIndex });

      const outcome = await combatWs.waitForMessage('TurnOutcome', outcomeTimeoutMs);
      if (outcome.turnIndex !== actionRequest.turnIndex) {
        throw new Error(
          `Turn outcome mismatch: expected turn ${actionRequest.turnIndex}, got ${outcome.turnIndex}`,
        );
      }

      const playbackUnits = outcome.fieldAtFightStart.map((unit) => ({ ...unit }));
      this.ui.showCombatField(playbackUnits);
      await this.ui.showPlayback(outcome, playbackUnits, this.config.fightPlaybackSeconds * 1000);

      await this.ensureFieldPhase(combatWs, 'round_end', outcomeTimeoutMs);
      this.suppressArenaSync = false;
      this.pendingGameStates = [];

      this.ui.setScreen('combat_round_end', { round, turnIndex: actionRequest.turnIndex });
      const roundResult = await combatWs.waitForMessage('RoundResult', roundTimeoutMs);
      this.ui.showRoundResult(roundResult);
    }
  }
}

export function formatUnitLabel(unitType: UnitType): string {
  return getUnitDisplayName(unitType);
}
