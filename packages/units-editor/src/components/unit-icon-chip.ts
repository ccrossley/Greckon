import {
  createUnitSpriteGroup,
  getHealthBorderColor,
  hasUnitSprite,
  resolveUnitFillColor,
  UNIT_ICON_SIZE,
  UNIT_STROKE_WIDTH,
} from '@greckon/core';
import { resolveIconPath } from '../icon-path.js';
import type { EditorUnit } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createUnitIconChip(unit: EditorUnit, sizePx = 28): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'unit-icon-chip';
  wrap.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${UNIT_ICON_SIZE} ${UNIT_ICON_SIZE}`);
  svg.setAttribute('width', String(sizePx));
  svg.setAttribute('height', String(sizePx));

  if (hasUnitSprite(unit.id)) {
    const sprite = createUnitSpriteGroup(unit.id);
    if (sprite) {
      svg.appendChild(sprite);
      wrap.appendChild(svg);
      return wrap;
    }
  }

  const iconPath = resolveIconPath(unit);
  if (!iconPath) {
    return wrap;
  }

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', iconPath);
  path.setAttribute('fill', resolveUnitFillColor(unit, 1));
  path.setAttribute('stroke', getHealthBorderColor(1));
  path.setAttribute('stroke-width', String(UNIT_STROKE_WIDTH));
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('paint-order', 'stroke fill');
  svg.appendChild(path);
  wrap.appendChild(svg);

  return wrap;
}
