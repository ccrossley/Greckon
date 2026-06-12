import {
  createUnitSpriteGroup,
  getHealthBorderColor,
  getUnitIconScale,
  hasUnitSprite,
  MAX_UNIT_LEVEL,
  resolveUnitFillColor,
  UNIT_ICON_SIZE,
  UNIT_STROKE_WIDTH,
} from '@greckon/core';
import { resolveIconPath } from '../icon-path.js';
import type { EditorUnit } from '../types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PREVIEW_RADIUS = 36;

function appendDirectIcon(
  parent: SVGElement,
  iconPath: string,
  fill: string,
  stroke: string,
  strokeWidth = 16,
): void {
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', iconPath);
  path.setAttribute('fill', fill);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', String(strokeWidth));
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('paint-order', 'stroke fill');
  parent.appendChild(path);
}

function appendScaledIcon(
  parent: SVGElement,
  iconPath: string,
  cx: number,
  cy: number,
  visualRadius: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
): SVGGElement {
  const scale = getUnitIconScale(visualRadius);
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute(
    'transform',
    `translate(${cx} ${cy}) scale(${scale}) translate(${-UNIT_ICON_SIZE / 2} ${-UNIT_ICON_SIZE / 2})`,
  );

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', iconPath);
  path.setAttribute('fill', fill);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', String(strokeWidth / scale));
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  path.setAttribute('paint-order', 'stroke fill');
  group.appendChild(path);
  parent.appendChild(group);
  return group;
}

function appendScaledUnitSprite(
  parent: SVGElement,
  unitId: string,
  cx: number,
  cy: number,
  visualRadius: number,
): SVGGElement | null {
  const sprite = createUnitSpriteGroup(unitId);
  if (!sprite) {
    return null;
  }
  const scale = getUnitIconScale(visualRadius);
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute(
    'transform',
    `translate(${cx} ${cy}) scale(${scale}) translate(${-UNIT_ICON_SIZE / 2} ${-UNIT_ICON_SIZE / 2})`,
  );
  group.appendChild(sprite);
  parent.appendChild(group);
  return group;
}

export function createUnitPreview(unit: EditorUnit): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'unit-preview';

  const mainSvg = document.createElementNS(SVG_NS, 'svg');
  mainSvg.setAttribute('class', 'unit-preview-main');
  mainSvg.setAttribute('viewBox', '0 0 200 200');
  mainSvg.setAttribute('aria-label', `${unit.name} preview`);

  const rangeRing = document.createElementNS(SVG_NS, 'circle');
  rangeRing.setAttribute('class', 'unit-preview-range');
  rangeRing.setAttribute('cx', '100');
  rangeRing.setAttribute('cy', '100');
  rangeRing.setAttribute('r', String(40 + unit.attackRange * 120));
  mainSvg.appendChild(rangeRing);

  const iconPath = resolveIconPath(unit);
  if (hasUnitSprite(unit.id)) {
    appendScaledUnitSprite(mainSvg, unit.id, 100, 100, PREVIEW_RADIUS);
  } else if (iconPath) {
    appendScaledIcon(
      mainSvg,
      iconPath,
      100,
      100,
      PREVIEW_RADIUS,
      resolveUnitFillColor(unit, 1),
      getHealthBorderColor(1),
      UNIT_STROKE_WIDTH * 8,
    );
  } else {
    const missing = document.createElementNS(SVG_NS, 'text');
    missing.setAttribute('x', '100');
    missing.setAttribute('y', '104');
    missing.setAttribute('text-anchor', 'middle');
    missing.setAttribute('class', 'unit-preview-missing-icon');
    missing.textContent = 'Unknown icon';
    mainSvg.appendChild(missing);
  }

  const attackLayer = document.createElementNS(SVG_NS, 'g');
  attackLayer.setAttribute('class', 'unit-preview-attack-layer');
  mainSvg.appendChild(attackLayer);

  wrap.appendChild(mainSvg);

  const levels = document.createElement('div');
  levels.className = 'unit-preview-levels';
  for (let level = 1; level <= MAX_UNIT_LEVEL; level++) {
    const chip = document.createElement('div');
    chip.className = 'unit-preview-level-chip';

    const label = document.createElement('span');
    label.className = 'unit-preview-level-label';
    label.textContent = `L${level}`;
    chip.appendChild(label);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${UNIT_ICON_SIZE} ${UNIT_ICON_SIZE}`);
    svg.setAttribute('width', '40');
    svg.setAttribute('height', '40');
    if (hasUnitSprite(unit.id)) {
      const sprite = createUnitSpriteGroup(unit.id);
      if (sprite) {
        svg.appendChild(sprite);
      }
    } else if (iconPath) {
      appendDirectIcon(
        svg,
        iconPath,
        resolveUnitFillColor(unit, level),
        getHealthBorderColor(1),
      );
    }
    chip.appendChild(svg);
    levels.appendChild(chip);
  }
  wrap.appendChild(levels);

  const meta = document.createElement('p');
  meta.className = 'unit-preview-meta muted';
  meta.textContent = `${unit.icon} · ${unit.attackType} · ${unit.movementType}`;
  wrap.appendChild(meta);

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.textContent = 'Play attack preview';
  playBtn.addEventListener('click', () => playAttackPreview(attackLayer, unit));
  wrap.appendChild(playBtn);

  return wrap;
}

function playAttackPreview(layer: SVGGElement, unit: EditorUnit): void {
  layer.replaceChildren();
  if (unit.attackType === 'line' || unit.attackType === 'multi') {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'attack-line');
    line.setAttribute('x1', '100');
    line.setAttribute('y1', '100');
    line.setAttribute('x2', '170');
    line.setAttribute('y2', '60');
    layer.appendChild(line);
    window.setTimeout(() => line.remove(), 200);
    return;
  }
  if (unit.attackType === 'projectile') {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'attack-line attack-line-projectile');
    line.setAttribute('x1', '100');
    line.setAttribute('y1', '100');
    line.setAttribute('x2', '170');
    line.setAttribute('y2', '60');
    const travelMs = unit.travelTimeMs > 0 ? unit.travelTimeMs : 350;
    line.style.setProperty('--travel-ms', String(travelMs));
    layer.appendChild(line);
    window.setTimeout(() => line.remove(), travelMs + 50);
    return;
  }
  const burst = document.createElementNS(SVG_NS, 'circle');
  burst.setAttribute('class', 'attack-burst');
  burst.setAttribute('cx', '170');
  burst.setAttribute('cy', '60');
  burst.setAttribute('r', '8');
  layer.appendChild(burst);
  window.setTimeout(() => burst.remove(), 200);
}
