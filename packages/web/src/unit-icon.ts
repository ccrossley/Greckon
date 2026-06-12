import type { UnitType } from '@greckon/core';
import {
  createUnitSpriteGroup,
  getHealthBorderColor,
  getUnitIconPath,
  hasUnitSprite,
  resolveUnitFillColor,
  UNIT_ICON_SIZE,
  UNIT_ICON_STROKE_WIDTH,
} from '@greckon/core';
import { resolveService, ServiceTokens } from '@greckon/services';
import type { UnitCatalog } from '@greckon/services/units';

export function createUnitIcon(unitType: UnitType, level = 1, size = 36): SVGSVGElement {
  const unit = resolveService<UnitCatalog>(ServiceTokens.UnitCatalog).getUnitDefinition(unitType);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'unit-icon');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${UNIT_ICON_SIZE} ${UNIT_ICON_SIZE}`);
  svg.setAttribute('aria-hidden', 'true');

  if (hasUnitSprite(unitType)) {
    const sprite = createUnitSpriteGroup(unitType);
    if (sprite) {
      svg.appendChild(sprite);
      return svg;
    }
  }

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', getUnitIconPath(unitType));
  path.setAttribute('fill', resolveUnitFillColor(unit, level));
  path.setAttribute('stroke', getHealthBorderColor(1));
  path.setAttribute('stroke-width', String(UNIT_ICON_STROKE_WIDTH));
  path.setAttribute('paint-order', 'stroke fill');
  svg.appendChild(path);

  return svg;
}

export function appendUnitButtonLabel(
  button: HTMLButtonElement,
  label: string,
  unitType?: UnitType,
  level = 1,
): void {
  button.classList.add('unit-button');
  button.replaceChildren();
  if (unitType) {
    button.appendChild(createUnitIcon(unitType, level));
  }
  const text = document.createElement('span');
  text.className = 'unit-button-label';
  text.textContent = label;
  button.appendChild(text);
}
