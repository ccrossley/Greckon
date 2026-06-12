import type { CombatUnit, FactionId, NetworkMessage, PickPhase, UnitType } from '@greckon/core';
import {
  getFactionDisplayName,
  getUnitDisplayName,
  listFactions,
  MAX_UNIT_LEVEL,
  parseTurnActionId,
  pickBotTurnActions,
  pickRandomUnitType,
  getIconPathBySlug,
  UNIT_ICON_SIZE,
  UNIT_ICON_STROKE_WIDTH,
} from '@greckon/core';
import type { CombatArena } from './combat-arena.js';
import { mountCountdownBar } from './countdown-bar.js';
import { appendUnitButtonLabel } from './unit-icon.js';

export type ScreenName =
  | 'login'
  | 'faction_select'
  | 'lobby'
  | 'loading'
  | 'combat_secret_draft'
  | 'combat_unit_pick'
  | 'combat_action_selection'
  | 'combat_fight_playback'
  | 'combat_round_end'
  | 'combat_match_end';

export interface GameUi {
  setScreen(screen: ScreenName, meta?: { round?: number; turnIndex?: number; pickIndex?: number }): void;
  log(message: string): void;
  wait(ms: number): Promise<void>;
  pickFaction(): Promise<FactionId>;
  showLobbyQueue(position: number, factionId: FactionId): void;
  showPlayAgain(username: string): void;
  showCombatField(units: CombatUnit[]): void;
  hideCombatField(): void;
  isPlaybackActive(): boolean;
  showCombatWait(message: string): void;
  hideCombatWait(): void;
  showSecretDraft(ownDraft: UnitType[]): void;
  pickUnit(
    options: UnitType[],
    pickIndex: number,
    deadlineMs: number,
    playerId: string,
    pickPhase: PickPhase,
  ): Promise<UnitType>;
  pickActions(
    available: Array<{ unitId: string; actionId: string; label: string }>,
    deadlineMs: number,
    turnIndex: number,
    playerId: string,
    fieldUnits: CombatUnit[],
    pickIndex: number,
    pickCount: number,
  ): Promise<Array<{ unitId: string; actionId: string }>>;
  showPlayback(
    outcome: Extract<NetworkMessage, { type: 'TurnOutcome' }>,
    units: CombatUnit[],
    durationMs: number,
  ): Promise<void>;
  showRoundResult(result: Extract<NetworkMessage, { type: 'RoundResult' }>): void;
  showMatchResult(result: Extract<NetworkMessage, { type: 'MatchResult' }>): void;
}

export function createGameUi(
  root: HTMLElement,
  logEl: HTMLElement,
  statusEl: HTMLElement,
  arena: CombatArena,
  combatStage: HTMLElement,
  combatOverlay: HTMLElement,
): GameUi {
  const log = (message: string) => {
    const line = document.createElement('div');
    line.textContent = message;
    logEl.prepend(line);
  };

  const clearScreen = () => {
    root.replaceChildren();
  };

  return {
    setScreen(screen, meta = {}) {
      const suffix = meta.round
        ? ` · round ${meta.round}${meta.turnIndex !== undefined ? ` turn ${meta.turnIndex + 1}` : ''}`
        : meta.pickIndex
          ? ` · pick ${meta.pickIndex}`
          : '';
      statusEl.textContent = `${screen.replaceAll('_', ' ')}${suffix}`;
      log(`[screen] ${screen}${suffix}`);
    },

    log,

    wait(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    },

    showLobbyQueue(position, factionId) {
      arena.hide();
      clearScreen();
      const factionName = getFactionDisplayName(factionId);
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <h2>Lobby</h2>
        <p class="lead">Playing as <strong>${factionName}</strong> — queue position <strong>${position}</strong>.</p>
        <p class="muted">Match starts when you are connected and an opponent is ready.</p>
      `;
      root.appendChild(panel);
    },

    pickFaction() {
      arena.hide();
      clearScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <h2>Choose your faction</h2>
        <p class="muted">You will draft units only from this faction at the start of each match.</p>
      `;
      const grid = document.createElement('div');
      grid.className = 'faction-grid';

      return new Promise((resolve) => {
        for (const faction of listFactions()) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'faction-card';
          button.style.setProperty('--faction-accent', faction.accentColor);

          const emblem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          emblem.setAttribute('class', 'faction-emblem');
          emblem.setAttribute('width', '48');
          emblem.setAttribute('height', '48');
          emblem.setAttribute('viewBox', `0 0 ${UNIT_ICON_SIZE} ${UNIT_ICON_SIZE}`);
          emblem.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', getIconPathBySlug(faction.emblemIcon));
          path.setAttribute('fill', faction.accentColor);
          path.setAttribute('stroke', '#0f1419');
          path.setAttribute('stroke-width', String(UNIT_ICON_STROKE_WIDTH));
          path.setAttribute('paint-order', 'stroke fill');
          emblem.appendChild(path);

          const name = document.createElement('span');
          name.className = 'faction-name';
          name.textContent = faction.name;

          const tagline = document.createElement('span');
          tagline.className = 'faction-tagline muted';
          tagline.textContent = faction.tagline;

          button.append(emblem, name, tagline);
          button.addEventListener('click', () => {
            log(`Selected faction ${faction.name}`);
            resolve(faction.id);
          });
          grid.appendChild(button);
        }
        panel.appendChild(grid);
        root.appendChild(panel);
      });
    },

    showPlayAgain(username) {
      arena.hide();
      clearScreen();
      statusEl.textContent = 'faction select';
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `<h2>Ready for another match?</h2>`;
      const button = document.createElement('button');
      button.className = 'primary';
      button.textContent = 'Choose faction';
      button.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('greckon:play', { detail: { username } }));
      });
      panel.appendChild(button);
      root.appendChild(panel);
    },

    showCombatField(units) {
      combatStage.hidden = false;
      arena.show();
      arena.showField(units);
    },

    isPlaybackActive() {
      return arena.isPlaybackActive();
    },

    hideCombatField() {
      combatStage.hidden = true;
      combatOverlay.hidden = true;
      combatOverlay.replaceChildren();
      combatOverlay.classList.remove('combat-overlay-status');
      arena.hide();
    },

    showCombatWait(message) {
      combatOverlay.hidden = false;
      combatOverlay.classList.add('combat-overlay-status');
      combatOverlay.replaceChildren();
      const banner = document.createElement('p');
      banner.className = 'combat-wait-banner';
      banner.textContent = message;
      combatOverlay.appendChild(banner);
    },

    hideCombatWait() {
      combatOverlay.hidden = true;
      combatOverlay.replaceChildren();
      combatOverlay.classList.remove('combat-overlay-status');
    },

    showSecretDraft(ownDraft) {
      combatStage.hidden = false;
      arena.show();
      arena.showField([]);
      clearScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `<h2>Secret draft</h2><p class="muted">Your action pool is hidden from the opponent.</p>`;
      if (ownDraft.length > 0) {
        const list = document.createElement('ul');
        list.className = 'draft-list';
        for (const unitType of ownDraft) {
          const item = document.createElement('li');
          item.textContent = formatUnitLabel(unitType);
          list.appendChild(item);
        }
        panel.appendChild(list);
      }
      root.appendChild(panel);
    },

    pickUnit(options, pickIndex, deadlineMs, playerId, pickPhase) {
      clearScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      const totalPicks = pickPhase === 'secret_draft' ? 4 : 3;
      const heading =
        pickPhase === 'secret_draft'
          ? `Secret draft · pick ${pickIndex} of ${totalPicks}`
          : `Deploy unit ${pickIndex} of ${totalPicks}`;
      const hint =
        pickPhase === 'secret_draft'
          ? 'Choose a unit for your action pool. Each unit type can only be picked once. Opponents cannot see these picks.'
          : 'Choose a unit to deploy. Both squads update on the field after each pick.';
      panel.innerHTML = `<h2>${heading}</h2><p class="muted">${hint}</p>`;
      const stopCountdown = mountCountdownBar(panel, deadlineMs);
      const status = document.createElement('p');
      status.className = 'muted';
      panel.appendChild(status);
      const grid = document.createElement('div');
      grid.className = 'button-grid';

      return new Promise((resolve) => {
        let settled = false;
        const choose = (unitType: UnitType, auto = false) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(deadlineTimer);
          stopCountdown();
          for (const button of grid.querySelectorAll('button')) {
            (button as HTMLButtonElement).disabled = true;
          }
          status.textContent = auto
            ? `Timed out — auto-picked ${formatUnitLabel(unitType)}`
            : `Selected ${formatUnitLabel(unitType)} — waiting for opponent…`;
          log(
            auto
              ? `Auto-picked ${formatUnitLabel(unitType)} (${unitType})`
              : `Picked ${formatUnitLabel(unitType)} (${unitType})`,
          );
          resolve(unitType);
        };

        const deadlineTimer = window.setTimeout(() => {
          const fallback =
            pickRandomUnitType(options, pickIndex, playerId) ?? options[0];
          if (fallback) {
            choose(fallback, true);
          }
        }, deadlineMs);

        for (const unitType of options) {
          const button = document.createElement('button');
          button.type = 'button';
          appendUnitButtonLabel(button, formatUnitLabel(unitType), unitType);
          button.addEventListener('click', () => choose(unitType));
          grid.appendChild(button);
        }
        panel.appendChild(grid);
        root.appendChild(panel);
      });
    },

    pickActions(available, deadlineMs, turnIndex, playerId, fieldUnits, pickIndex, pickCount) {
      clearScreen();
      combatOverlay.hidden = false;
      combatOverlay.classList.remove('combat-overlay-status');
      combatOverlay.replaceChildren();
      const panel = document.createElement('div');
      panel.className = 'panel action-overlay-panel';
      const status = document.createElement('p');
      status.className = 'muted';
      panel.innerHTML = `<h2>Pick action ${pickIndex} of ${pickCount}</h2>`;
      status.textContent = 'Choose one of the three actions below.';
      panel.appendChild(status);

      const stopCountdown = mountCountdownBar(panel, deadlineMs);

      const grid = document.createElement('div');
      grid.className = 'button-grid';

      return new Promise((resolve) => {
        let settled = false;

        const finish = (
          action: { unitId: string; actionId: string; label: string },
          auto = false,
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(deadlineTimer);
          stopCountdown();
          combatOverlay.hidden = true;
          combatOverlay.replaceChildren();
          for (const button of grid.querySelectorAll('button')) {
            (button as HTMLButtonElement).disabled = true;
          }
          log(auto ? `Auto-picked ${action.label}` : `Picked ${action.label}`);
          resolve([{ unitId: action.unitId, actionId: action.actionId }]);
        };

        const deadlineTimer = window.setTimeout(() => {
          const fallback = pickBotTurnActions(available, turnIndex, `${playerId}:${pickIndex}`, 1)[0];
          if (fallback) {
            finish(fallback, true);
          } else if (available[0]) {
            finish(available[0], true);
          }
        }, deadlineMs);

        for (const action of available) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.actionId = action.actionId;
          const parsed = parseTurnActionId(action.actionId);
          let displayLevel = 1;
          if (parsed) {
            const owned = fieldUnits.filter(
              (unit) =>
                unit.playerId === playerId && unit.unitType === parsed.unitType && unit.hp > 0,
            );
            const currentLevel =
              owned.length > 0 ? Math.max(...owned.map((unit) => unit.level)) : 1;
            displayLevel =
              parsed.kind === 'upgrade'
                ? Math.min(MAX_UNIT_LEVEL, currentLevel + 1)
                : parsed.kind === 'add'
                  ? 1
                  : currentLevel;
          }
          appendUnitButtonLabel(button, action.label, parsed?.unitType, displayLevel);
          button.addEventListener('click', () => finish(action));
          grid.appendChild(button);
        }
        panel.appendChild(grid);
        combatOverlay.appendChild(panel);
      });
    },

    async showPlayback(outcome, units, durationMs) {
      combatOverlay.hidden = true;
      combatOverlay.replaceChildren();
      combatOverlay.classList.remove('combat-overlay-status');
      const panel = document.createElement('div');
      panel.className = 'panel playback playback-banner';
      panel.innerHTML = `<h2>Fight playback</h2>`;
      const summary = document.createElement('p');
      summary.className = 'muted';
      summary.textContent = `${outcome.playback.length} events · score ${outcome.roundScore.playerA}:${outcome.roundScore.playerB}`;
      panel.appendChild(summary);
      root.replaceChildren(panel);
      await arena.playOutcome(units, outcome.playback, durationMs, {
        fightStartMs: outcome.fightStartMs,
      });
    },

    showRoundResult(result) {
      clearScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <h2>Round ${result.round} complete</h2>
        <p class="lead">Score — You: ${result.roundWins.playerA} · Opponent: ${result.roundWins.playerB}</p>
      `;
      root.appendChild(panel);
    },

    showMatchResult(result) {
      arena.hide();
      clearScreen();
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <h2>Match over</h2>
        <p class="lead">Final score — ${result.finalRoundWins.playerA} : ${result.finalRoundWins.playerB}</p>
        <p class="muted">Winner player id: ${result.winnerPlayerId}</p>
      `;
      root.appendChild(panel);
    },
  };
}

export function formatUnitLabel(unitType: UnitType): string {
  return getUnitDisplayName(unitType);
}

export function showLoginForm(
  root: HTMLElement,
  defaultUsername: string,
  onSubmit: (username: string) => void,
): void {
  root.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = `
    <h2>Play Greckon</h2>
    <p class="muted">Sign in with a username to join the lobby and fight the bot opponent.</p>
  `;

  const form = document.createElement('form');
  form.className = 'login-form';
  const label = document.createElement('label');
  label.textContent = 'Username';
  const input = document.createElement('input');
  input.name = 'username';
  input.autocomplete = 'username';
  input.required = true;
  input.value = defaultUsername;
  input.placeholder = 'your name';
  label.appendChild(input);

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'primary';
  button.textContent = 'Continue';

  form.append(label, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = input.value.trim();
    if (username) {
      onSubmit(username);
    }
  });

  panel.appendChild(form);
  root.appendChild(panel);
}
