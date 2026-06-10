import { getSelectedUnit, selectUnit, state, subscribe } from '../state.js';
import { createUnitIconChip } from './unit-icon-chip.js';

export function mountUnitList(root: HTMLElement): void {
  const list = document.createElement('div');
  list.className = 'unit-list';
  root.appendChild(list);

  const render = () => {
    list.replaceChildren();
    state.units.forEach((unit, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'unit-list-item';
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
    });
  };

  subscribe(render);
  render();
}

export function highlightUnitInList(): void {
  const unit = getSelectedUnit();
  if (!unit) {
    return;
  }
  document.querySelectorAll('.unit-list-item').forEach((element, index) => {
    element.classList.toggle('selected', index === state.selectedIndex);
  });
}
