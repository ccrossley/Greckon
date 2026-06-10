import type { EditorTab, EditorUnit, StatKey } from './types.js';

export type StateListener = () => void;

export interface EditorState {
  units: EditorUnit[];
  selectedIndex: number;
  activeTab: EditorTab;
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  loadError: string | null;
  primaryStat: StatKey;
  overlayStats: Set<StatKey>;
}

const listeners = new Set<StateListener>();

export const state: EditorState = {
  units: [],
  selectedIndex: 0,
  activeTab: 'appearance',
  dirty: false,
  saving: false,
  saveError: null,
  loadError: null,
  primaryStat: 'maxHp',
  overlayStats: new Set(),
};

export function subscribe(listener: StateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setUnits(units: EditorUnit[]): void {
  state.units = units.map((unit) => ({ ...unit }));
  state.selectedIndex = Math.min(state.selectedIndex, Math.max(0, units.length - 1));
  state.dirty = false;
  state.saveError = null;
  notify();
}

export function selectUnit(index: number): void {
  if (index < 0 || index >= state.units.length) {
    return;
  }
  state.selectedIndex = index;
  notify();
}

export function setActiveTab(tab: EditorTab): void {
  state.activeTab = tab;
  notify();
}

export function updateSelectedUnit(patch: Partial<EditorUnit>): void {
  const unit = state.units[state.selectedIndex];
  if (!unit) {
    return;
  }
  Object.assign(unit, patch);
  state.dirty = true;
  state.saveError = null;
  notify();
}

export function updateUnitStat(index: number, stat: StatKey, value: number): void {
  const unit = state.units[index];
  if (!unit) {
    return;
  }
  unit[stat] = Math.max(1, Math.round(value));
  state.dirty = true;
  state.saveError = null;
  notify();
}

export function setPrimaryStat(stat: StatKey): void {
  state.primaryStat = stat;
  notify();
}

export function toggleOverlayStat(stat: StatKey): void {
  if (state.overlayStats.has(stat)) {
    state.overlayStats.delete(stat);
  } else if (stat !== state.primaryStat) {
    state.overlayStats.add(stat);
  }
  notify();
}

export function getSelectedUnit(): EditorUnit | null {
  return state.units[state.selectedIndex] ?? null;
}
