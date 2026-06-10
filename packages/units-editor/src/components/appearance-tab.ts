import { listIconSlugs } from '@greckon/core';
import type { AttackType, MovementType, UpgradeColorMod } from '../types.js';
import { getSelectedUnit, state, subscribe, updateSelectedUnit } from '../state.js';
import { createUnitPreview } from './unit-preview.js';

const ATTACK_TYPES: AttackType[] = ['line', 'projectile', 'instant', 'multi'];
const MOVEMENT_TYPES: MovementType[] = ['float', 'hop', 'charge'];
const UPGRADE_MODS: UpgradeColorMod[] = ['spectrum', 'hue_shift', 'lighten', 'saturate'];

function createField(
  label: string,
  input: HTMLElement,
): HTMLElement {
  const field = document.createElement('label');
  field.className = 'field';
  const title = document.createElement('span');
  title.className = 'field-label';
  title.textContent = label;
  field.append(title, input);
  return field;
}

function createNumberInput(value: number, onChange: (value: number) => void, step = 1): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('change', () => onChange(Number(input.value)));
  return input;
}

function createSelect<T extends string>(value: T, options: T[], onChange: (value: T) => void): HTMLSelectElement {
  const select = document.createElement('select');
  for (const option of options) {
    const element = document.createElement('option');
    element.value = option;
    element.textContent = option;
    select.appendChild(element);
  }
  select.value = value;
  select.addEventListener('change', () => onChange(select.value as T));
  return select;
}

export function mountAppearanceTab(root: HTMLElement): void {
  const panel = document.createElement('div');
  panel.className = 'appearance-tab';
  root.appendChild(panel);

  const previewHost = document.createElement('div');
  previewHost.className = 'appearance-preview-host';
  panel.appendChild(previewHost);

  const form = document.createElement('div');
  form.className = 'appearance-form';
  panel.appendChild(form);

  const identity = document.createElement('details');
  identity.className = 'identity-section';
  identity.open = false;
  const identitySummary = document.createElement('summary');
  identitySummary.textContent = 'Identity';
  identity.appendChild(identitySummary);
  const identityFields = document.createElement('div');
  identityFields.className = 'field-grid';
  identity.appendChild(identityFields);
  form.appendChild(identity);

  const visualFields = document.createElement('div');
  visualFields.className = 'field-grid';
  form.appendChild(visualFields);

  const render = () => {
    const unit = getSelectedUnit();
    if (!unit) {
      previewHost.replaceChildren();
      form.querySelectorAll('.field-grid').forEach((grid) => grid.replaceChildren());
      return;
    }

    previewHost.replaceChildren(createUnitPreview(unit));

    identityFields.replaceChildren(
      createField(
        'ID',
        (() => {
          const input = document.createElement('input');
          input.pattern = '^[a-z][a-z0-9_]*$';
          input.value = unit.id;
          input.addEventListener('change', () => updateSelectedUnit({ id: input.value.trim() }));
          return input;
        })(),
      ),
      createField(
        'Name',
        (() => {
          const input = document.createElement('input');
          input.value = unit.name;
          input.addEventListener('change', () => updateSelectedUnit({ name: input.value.trim() }));
          return input;
        })(),
      ),
    );

    visualFields.replaceChildren(
      createField(
        'Fill color',
        (() => {
          const input = document.createElement('input');
          input.type = 'color';
          input.value = unit.fillColor ?? '#808080';
          input.addEventListener('input', () => updateSelectedUnit({ fillColor: input.value }));
          return input;
        })(),
      ),
      createField(
        'Upgrade color mod',
        createSelect(unit.upgradeColorMod ?? 'spectrum', UPGRADE_MODS, (value) =>
          updateSelectedUnit({ upgradeColorMod: value }),
        ),
      ),
      createField(
        'Icon',
        createSelect(unit.icon, listIconSlugs(), (value) => updateSelectedUnit({ icon: value })),
      ),
      createField(
        'Attack type',
        createSelect(unit.attackType, ATTACK_TYPES, (value) => updateSelectedUnit({ attackType: value })),
      ),
      createField(
        'Movement type',
        createSelect(unit.movementType, MOVEMENT_TYPES, (value) => updateSelectedUnit({ movementType: value })),
      ),
      createField(
        'Attack range',
        createNumberInput(unit.attackRange, (value) => updateSelectedUnit({ attackRange: value }), 0.001),
      ),
      createField(
        'Attack delay (ms)',
        createNumberInput(unit.attackDelayMs, (value) =>
          updateSelectedUnit({ attackDelayMs: Math.max(0, Math.round(value)) }),
        ),
      ),
      createField(
        'Travel time (ms)',
        createNumberInput(unit.travelTimeMs, (value) =>
          updateSelectedUnit({ travelTimeMs: Math.max(0, Math.round(value)) }),
        ),
      ),
    );
  };

  subscribe(render);
  render();
}
