import { resolveService, ServiceTokens } from '@greckon/services';
import type { UnitDataClient } from '@greckon/services/units/client';
import { mountAppearanceTab } from './components/appearance-tab.js';
import { mountPlaygroundTab } from './components/playground-tab.js';
import { mountStatsSplineTab } from './components/stats-spline-tab.js';
import { mountUnitList } from './components/unit-list.js';
import { setActiveTab, setUnits, state, subscribe } from './state.js';
import type { EditorTab } from './types.js';

function unitData(): UnitDataClient {
  return resolveService(ServiceTokens.UnitData);
}

export async function mountApp(root: HTMLElement): Promise<void> {
  root.className = 'editor-app';

  const header = document.createElement('header');
  header.className = 'editor-header';
  root.appendChild(header);

  const title = document.createElement('h1');
  title.textContent = 'Units Editor';
  header.appendChild(title);

  const headerActions = document.createElement('div');
  headerActions.className = 'editor-header-actions';
  header.appendChild(headerActions);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'primary';
  saveBtn.textContent = 'Save';
  headerActions.appendChild(saveBtn);

  const status = document.createElement('p');
  status.className = 'editor-status muted';
  header.appendChild(status);

  const body = document.createElement('div');
  body.className = 'editor-body';
  root.appendChild(body);

  const sidebar = document.createElement('aside');
  sidebar.className = 'editor-sidebar';
  body.appendChild(sidebar);
  mountUnitList(sidebar);

  const main = document.createElement('main');
  main.className = 'editor-main';
  body.appendChild(main);

  const tabs = document.createElement('div');
  tabs.className = 'editor-tabs';
  main.appendChild(tabs);

  const tabPanels = document.createElement('div');
  tabPanels.className = 'editor-tab-panels';
  main.appendChild(tabPanels);

  const appearancePanel = document.createElement('section');
  appearancePanel.className = 'editor-tab-panel';
  appearancePanel.dataset.tab = 'appearance';
  tabPanels.appendChild(appearancePanel);
  mountAppearanceTab(appearancePanel);

  const statsPanel = document.createElement('section');
  statsPanel.className = 'editor-tab-panel';
  statsPanel.dataset.tab = 'stats';
  statsPanel.hidden = true;
  tabPanels.appendChild(statsPanel);
  mountStatsSplineTab(statsPanel);

  const playgroundPanel = document.createElement('section');
  playgroundPanel.className = 'editor-tab-panel';
  playgroundPanel.dataset.tab = 'playground';
  playgroundPanel.hidden = true;
  tabPanels.appendChild(playgroundPanel);
  mountPlaygroundTab(playgroundPanel);

  const tabButtons = new Map<EditorTab, HTMLButtonElement>();
  const tabLabels: Record<EditorTab, string> = {
    appearance: 'Appearance',
    stats: 'Stats',
    playground: 'Playground',
  };
  for (const tab of ['appearance', 'stats', 'playground'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'editor-tab';
    button.textContent = tabLabels[tab];
    button.addEventListener('click', () => setActiveTab(tab));
    tabs.appendChild(button);
    tabButtons.set(tab, button);
  }

  saveBtn.addEventListener('click', async () => {
    state.saving = true;
    state.saveError = null;
    notifyUi();
    try {
      await unitData().saveUnits(state.units);
      state.dirty = false;
      state.saveError = null;
    } catch (error) {
      state.saveError = error instanceof Error ? error.message : String(error);
    } finally {
      state.saving = false;
      notifyUi();
    }
  });

  function notifyUi(): void {
    for (const listener of uiListeners) {
      listener();
    }
  }

  const uiListeners = new Set<() => void>();

  const renderChrome = () => {
    saveBtn.disabled = !state.dirty || state.saving;
    saveBtn.textContent = state.saving ? 'Saving…' : state.dirty ? 'Save changes' : 'Saved';

    if (state.loadError) {
      status.textContent = `Load error: ${state.loadError}`;
      status.classList.add('error');
    } else if (state.saveError) {
      status.textContent = `Save error: ${state.saveError}`;
      status.classList.add('error');
    } else if (state.dirty) {
      status.textContent = 'Unsaved changes';
      status.classList.remove('error');
    } else {
      status.textContent = `${state.units.length} units loaded`;
      status.classList.remove('error');
    }

    for (const [tab, button] of tabButtons) {
      button.classList.toggle('active', tab === state.activeTab);
    }
    appearancePanel.hidden = state.activeTab !== 'appearance';
    statsPanel.hidden = state.activeTab !== 'stats';
    playgroundPanel.hidden = state.activeTab !== 'playground';
  };

  uiListeners.add(renderChrome);
  subscribe(renderChrome);

  try {
    const units = await unitData().loadUnits();
    setUnits(units);
  } catch (error) {
    state.loadError = error instanceof Error ? error.message : String(error);
    notifyUi();
  }

  renderChrome();
}
