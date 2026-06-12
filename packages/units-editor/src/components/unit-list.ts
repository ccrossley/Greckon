import { listFactions } from '@greckon/core';
import {
  selectUnit,
  setSelectedFaction,
  state,
  subscribe,
  unitIndicesForFaction,
} from '../state.js';
import { createUnitIconChip } from './unit-icon-chip.js';

export function mountUnitList(root: HTMLElement): void {
  const tabs = document.createElement('div');
  tabs.className = 'faction-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Factions');
  root.appendChild(tabs);

  const list = document.createElement('div');
  list.className = 'unit-list';
  root.appendChild(list);

  const render = () => {
    tabs.replaceChildren();
    for (const faction of listFactions()) {
      const count = unitIndicesForFaction(faction.id).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'faction-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(faction.id === state.selectedFactionId));
      button.dataset.factionId = faction.id;
      button.textContent = count > 0 ? `${faction.name} (${count})` : faction.name;
      button.style.setProperty('--faction-accent', faction.accentColor);
      if (faction.id === state.selectedFactionId) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => setSelectedFaction(faction.id));
      tabs.appendChild(button);
    }

    list.replaceChildren();
    for (const index of unitIndicesForFaction(state.selectedFactionId)) {
      const unit = state.units[index];
      if (!unit) {
        continue;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-list-item';
      button.dataset.unitIndex = String(index);
      if (index === state.selectedIndex) {
        button.classList.add('selected');
      }

      button.appendChild(createUnitIconChip(unit, 24));

      const name = document.createElement('span');
      name.className = 'unit-list-name';
      name.textContent = unit.name;
      button.appendChild(name);

      button.addEventListener('click', () => selectUnit(index));
      list.appendChild(button);
    }
  };

  subscribe(render);
  render();
}

export function highlightUnitInList(): void {
  document.querySelectorAll<HTMLElement>('.unit-list-item').forEach((element) => {
    const index = Number(element.dataset.unitIndex);
    element.classList.toggle('selected', index === state.selectedIndex);
  });
}
