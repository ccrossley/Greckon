import './bootstrap-services.js';
import { GameClient, savedUsername } from './game-client.js';
import { createCombatArena } from './combat-arena.js';
import { createGameUi, showLoginForm } from './ui.js';

const screenEl = document.querySelector<HTMLElement>('#screen')!;
const logEl = document.querySelector<HTMLElement>('#log')!;
const statusEl = document.querySelector<HTMLElement>('#status-line')!;
const combatStageEl = document.querySelector<HTMLElement>('#combat-stage')!;
const arenaEl = document.querySelector<HTMLElement>('#combat-arena')!;
const overlayEl = document.querySelector<HTMLElement>('#combat-overlay')!;

const arena = createCombatArena(arenaEl);
const ui = createGameUi(screenEl, logEl, statusEl, arena, combatStageEl, overlayEl);
const client = new GameClient(ui);

let running = false;

async function play(username: string): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    await client.start(username);
  } catch (error) {
    ui.log(error instanceof Error ? error.message : String(error));
    showLoginForm(screenEl, username, begin);
  } finally {
    running = false;
  }
}

function begin(username: string): void {
  void play(username);
}

window.addEventListener('greckon:play', (event) => {
  const detail = (event as CustomEvent<{ username: string }>).detail;
  begin(detail.username);
});

statusEl.textContent = 'login';
showLoginForm(screenEl, savedUsername(), begin);
