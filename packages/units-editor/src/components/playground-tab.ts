import type { CombatUnit, TurnActionKind, UnitType } from '@greckon/core';
import {
  applyTurnAction,
  createMovementState,
  formatTurnActionId,
  isTurnActionValid,
  playgroundMarchIdleMs,
  resetMovementState,
  resetUnitIdCounter,
  runPlaygroundMarchStep,
  simStepMs,
  type MovementState,
} from '@greckon/core';
import { resolveService, ServiceTokens } from '@greckon/services';
import type { UnitCatalog } from '@greckon/services/units';
import { createCombatArena, type CombatArena } from '../../../web/src/combat-arena.js';
import { getSelectedUnit, subscribe } from '../state.js';
import { createUnitIconChip } from './unit-icon-chip.js';

const PLAYGROUND_PLAYER = 'playground';
const ACTION_KINDS: TurnActionKind[] = ['add', 'double', 'upgrade'];
function unitCatalog(): UnitCatalog {
  return resolveService(ServiceTokens.UnitCatalog);
}

let playgroundUnits: CombatUnit[] = [];
let arena: CombatArena | null = null;
let marchTimer: ReturnType<typeof setTimeout> | null = null;
let marchInterval: ReturnType<typeof setInterval> | null = null;
let marchAtMs = 0;
let movementState: MovementState = createMovementState();
let marchRunning = false;

function selectedUnitType(): UnitType | null {
  const unit = getSelectedUnit();
  return unit ? (unit.id as UnitType) : null;
}

function countOwned(unitType: UnitType): { count: number; level: number } {
  const owned = playgroundUnits.filter(
    (unit) => unit.playerId === PLAYGROUND_PLAYER && unit.unitType === unitType && unit.hp > 0,
  );
  return {
    count: owned.length,
    level: owned.length > 0 ? Math.max(...owned.map((unit) => unit.level)) : 0,
  };
}

function stopMarchLoop(): void {
  if (marchInterval) {
    clearInterval(marchInterval);
    marchInterval = null;
  }
  marchRunning = false;
  marchAtMs = 0;
  resetMovementState(movementState);
}

function clearMarchSchedule(): void {
  if (marchTimer) {
    clearTimeout(marchTimer);
    marchTimer = null;
  }
}

function resetMarchSchedule(): void {
  clearMarchSchedule();
  stopMarchLoop();
  if (playgroundUnits.length === 0) {
    return;
  }
  marchTimer = setTimeout(() => {
    marchTimer = null;
    startMarchLoop();
  }, playgroundMarchIdleMs());
}

function startMarchLoop(): void {
  if (playgroundUnits.length === 0 || marchRunning || arena?.isPlaybackActive()) {
    return;
  }
  marchRunning = true;
  marchAtMs = 0;
  resetMovementState(movementState);
  marchInterval = setInterval(() => {
    void runMarchTick();
  }, simStepMs());
}

async function runMarchTick(): Promise<void> {
  if (!arena || arena.isPlaybackActive() || playgroundUnits.length === 0) {
    return;
  }

  const stepStart = marchAtMs;
  marchAtMs += simStepMs();

  const startPositions = new Map(
    playgroundUnits.map((unit) => [unit.unitId, { x: unit.x, y: unit.y }] as const),
  );

  const playback = [];
  runPlaygroundMarchStep(playgroundUnits, PLAYGROUND_PLAYER, marchAtMs, movementState, playback);

  const endPositions = new Map(
    playgroundUnits.map((unit) => [unit.unitId, { x: unit.x, y: unit.y }] as const),
  );

  for (const unit of playgroundUnits) {
    const start = startPositions.get(unit.unitId);
    if (start) {
      unit.x = start.x;
      unit.y = start.y;
    }
  }

  if (playback.length === 0) {
    for (const unit of playgroundUnits) {
      const end = endPositions.get(unit.unitId);
      if (end) {
        unit.x = end.x;
        unit.y = end.y;
      }
    }
    arena.showField([...playgroundUnits]);
    return;
  }

  await arena.playOutcome([...playgroundUnits], playback, simStepMs(), { motionStartMs: stepStart });

  for (const unit of playgroundUnits) {
    const end = endPositions.get(unit.unitId);
    if (end) {
      unit.x = end.x;
      unit.y = end.y;
    }
  }
}

export function mountPlaygroundTab(root: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'playground-tab';
  root.appendChild(panel);

  const sidebar = document.createElement('div');
  sidebar.className = 'playground-sidebar';
  panel.appendChild(sidebar);

  const heading = document.createElement('h2');
  heading.textContent = 'Playground';
  sidebar.appendChild(heading);

  const hint = document.createElement('p');
  hint.className = 'playground-hint muted';
  hint.textContent =
    'Select a unit in the list, then add, double, or upgrade. After 3 seconds idle, units march up the field.';
  sidebar.appendChild(hint);

  const selection = document.createElement('div');
  selection.className = 'playground-selection';
  sidebar.appendChild(selection);

  const stats = document.createElement('p');
  stats.className = 'playground-stats muted';
  sidebar.appendChild(stats);

  const actions = document.createElement('div');
  actions.className = 'playground-actions';
  sidebar.appendChild(actions);

  const actionButtons = new Map<TurnActionKind, HTMLButtonElement>();
  for (const kind of ACTION_KINDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
    actions.appendChild(button);
    actionButtons.set(kind, button);
  }

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear field';
  sidebar.appendChild(clearBtn);

  const arenaHost = document.createElement('div');
  arenaHost.className = 'playground-arena-host';
  panel.appendChild(arenaHost);

  arena = createCombatArena(arenaHost);
  arena.show();

  const renderControls = () => {
    const unit = getSelectedUnit();
    const unitType = selectedUnitType();

    selection.replaceChildren();
    if (!unit || !unitType) {
      selection.textContent = 'No unit selected';
      stats.textContent = '';
    } else {
      const definition = unitCatalog().getUnitDefinition(unitType);
      const owned = countOwned(unitType);

      selection.appendChild(createUnitIconChip(unit, 32));

      const label = document.createElement('span');
      label.className = 'playground-selection-label';
      label.textContent = `${unit.name} (${unitType})`;
      selection.appendChild(label);

      stats.textContent =
        owned.count === 0
          ? `On field: none · add spawns ${definition.addAmount}`
          : `On field: ${owned.count} at level ${owned.level}`;
    }

    const busy = arena?.isPlaybackActive() === true;
    for (const [kind, button] of actionButtons) {
      const enabled = unitType ? isTurnActionValid(kind, unitType, playgroundUnits, PLAYGROUND_PLAYER) : false;
      button.disabled = !enabled || busy;
    }
    clearBtn.disabled = busy;
  };

  async function runPlaygroundAction(kind: TurnActionKind): Promise<void> {
    const unitType = selectedUnitType();
    if (!unitType || !arena) {
      return;
    }

    const actionId = formatTurnActionId(kind, unitType);
    if (!isTurnActionValid(kind, unitType, playgroundUnits, PLAYGROUND_PLAYER)) {
      return;
    }

    resetMarchSchedule();

    const playback = [];
    applyTurnAction(playgroundUnits, PLAYGROUND_PLAYER, actionId, playback, 0);

    renderControls();

    if (playback.length > 0) {
      await arena.playOutcome([...playgroundUnits], playback, 350);
    } else {
      arena.showField([...playgroundUnits]);
    }

    renderControls();
    resetMarchSchedule();
  }

  for (const [kind, button] of actionButtons) {
    button.addEventListener('click', () => {
      void runPlaygroundAction(kind);
    });
  }

  clearBtn.addEventListener('click', () => {
    clearMarchSchedule();
    stopMarchLoop();
    playgroundUnits = [];
    resetUnitIdCounter();
    arena?.clear();
    renderControls();
  });

  subscribe(renderControls);
  renderControls();
}
