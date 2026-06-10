import type { StatKey } from '../types.js';
import { STAT_LABELS } from '../types.js';
import { notify, selectUnit, state, subscribe } from '../state.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;

const STAT_COLORS: Record<StatKey, string> = {
  maxHp: '#22c55e',
  attack: '#ef4444',
  defense: '#3b82f6',
  speed: '#eab308',
};

interface ChartPoint {
  x: number;
  y: number;
}

interface ChartLayout {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function getYRange(stat: StatKey): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const unit of state.units) {
    min = Math.min(min, unit[stat]);
    max = Math.max(max, unit[stat]);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 10 };
  }
  const pad = Math.max(1, Math.round((max - min) * 0.12));
  return { min: Math.max(1, min - pad), max: max + pad };
}

function toChartX(index: number, layout: ChartLayout): number {
  const span = layout.xMax - layout.xMin || 1;
  const inner = layout.width - layout.padding.left - layout.padding.right;
  return layout.padding.left + ((index - layout.xMin) / span) * inner;
}

function toChartY(value: number, layout: ChartLayout): number {
  const span = layout.yMax - layout.yMin || 1;
  const inner = layout.height - layout.padding.top - layout.padding.bottom;
  return layout.padding.top + (1 - (value - layout.yMin) / span) * inner;
}

function fromChartY(y: number, layout: ChartLayout): number {
  const inner = layout.height - layout.padding.top - layout.padding.bottom;
  const ratio = 1 - (y - layout.padding.top) / inner;
  return layout.yMin + ratio * (layout.yMax - layout.yMin);
}

function clientYToChartY(svg: SVGSVGElement, clientX: number, clientY: number, layout: ChartLayout): number {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) {
    const rect = svg.getBoundingClientRect();
    const scaleY = layout.height / rect.height;
    return (clientY - rect.top) * scaleY;
  }
  return point.matrixTransform(matrix.inverse()).y;
}

function catmullRomPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    return `M ${points[0]!.x} ${points[0]!.y}`;
  }
  if (points.length === 2) {
    return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;
  }

  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export function mountSplineChart(root: HTMLElement, stat: StatKey): void {
  const container = document.createElement('div');
  container.className = 'spline-chart-wrap spline-chart-wrap-compact';
  root.appendChild(container);

  const heading = document.createElement('div');
  heading.className = 'spline-chart-heading';
  heading.textContent = STAT_LABELS[stat];
  heading.style.color = STAT_COLORS[stat];
  container.appendChild(heading);

  const tooltip = document.createElement('div');
  tooltip.className = 'spline-tooltip';
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'spline-chart spline-chart-compact');
  svg.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
  svg.style.touchAction = 'none';
  container.appendChild(svg);

  const gridLayer = document.createElementNS(SVG_NS, 'g');
  gridLayer.setAttribute('class', 'spline-grid-layer');
  svg.appendChild(gridLayer);

  const pathsLayer = document.createElementNS(SVG_NS, 'g');
  pathsLayer.setAttribute('class', 'spline-paths-layer');
  svg.appendChild(pathsLayer);

  const knotsLayer = document.createElementNS(SVG_NS, 'g');
  knotsLayer.setAttribute('class', 'spline-knots-layer');
  svg.appendChild(knotsLayer);

  let layout: ChartLayout = {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    padding: { top: 14, right: 8, bottom: 22, left: 28 },
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 10,
  };

  let dragIndex: number | null = null;
  let dragLayout: ChartLayout | null = null;
  let dragMoved = false;
  let pathElement: SVGPathElement | null = null;
  const knotElements: SVGCircleElement[] = [];
  const knotHitElements: SVGCircleElement[] = [];

  const syncPathsAndKnots = (activeLayout: ChartLayout) => {
    const points: ChartPoint[] = state.units.map((unit, index) => ({
      x: toChartX(index, activeLayout),
      y: toChartY(unit[stat], activeLayout),
    }));
    if (pathElement) {
      pathElement.setAttribute('d', catmullRomPath(points));
    }

    state.units.forEach((unit, index) => {
      const x = toChartX(index, activeLayout);
      const y = toChartY(unit[stat], activeLayout);
      const knot = knotElements[index];
      const hit = knotHitElements[index];
      const selected = index === state.selectedIndex;
      if (knot) {
        knot.setAttribute('cx', String(x));
        knot.setAttribute('cy', String(y));
        knot.setAttribute('r', selected ? '5' : '4');
      }
      if (hit) {
        hit.setAttribute('cx', String(x));
        hit.setAttribute('cy', String(y));
      }
      if (dragIndex === index) {
        tooltip.hidden = false;
        tooltip.textContent = `${unit.name}: ${unit[stat]}`;
      }
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (dragIndex === null || !dragLayout) {
      return;
    }
    event.preventDefault();
    const localY = clientYToChartY(svg, event.clientX, event.clientY, dragLayout);
    const raw = fromChartY(localY, dragLayout);
    const unit = state.units[dragIndex];
    if (!unit) {
      return;
    }
    const nextValue = Math.max(1, Math.round(raw));
    if (unit[stat] === nextValue) {
      return;
    }
    unit[stat] = nextValue;
    state.dirty = true;
    state.saveError = null;
    dragMoved = true;
    syncPathsAndKnots(dragLayout);
  };

  const endDrag = () => {
    const index = dragIndex;
    dragIndex = null;
    dragLayout = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    if (index !== null && !dragMoved) {
      selectUnit(index);
    } else {
      notify();
    }
    dragMoved = false;
    render();
  };

  const startDrag = (event: PointerEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    dragIndex = index;
    dragLayout = { ...layout };
    dragMoved = false;
    state.selectedIndex = index;

    const target = event.currentTarget as Element;
    target.setPointerCapture(event.pointerId);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const render = () => {
    if (dragIndex !== null) {
      return;
    }

    gridLayer.replaceChildren();
    pathsLayer.replaceChildren();
    knotsLayer.replaceChildren();
    pathElement = null;
    knotElements.length = 0;
    knotHitElements.length = 0;

    if (state.units.length === 0) {
      return;
    }

    const yRange = getYRange(stat);
    layout = {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      padding: { top: 14, right: 8, bottom: 22, left: 28 },
      xMin: 0,
      xMax: Math.max(1, state.units.length - 1),
      yMin: yRange.min,
      yMax: yRange.max,
    };

    const step = Math.max(1, Math.round((layout.yMax - layout.yMin) / 4));
    for (let value = Math.ceil(layout.yMin / step) * step; value <= layout.yMax; value += step) {
      const y = toChartY(value, layout);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(layout.padding.left));
      line.setAttribute('x2', String(layout.width - layout.padding.right));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      gridLayer.appendChild(line);

      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', String(layout.padding.left - 4));
      label.setAttribute('y', String(y + 3));
      label.setAttribute('class', 'spline-axis-label');
      label.setAttribute('text-anchor', 'end');
      label.textContent = String(value);
      gridLayer.appendChild(label);
    }

    state.units.forEach((unit, index) => {
      const x = toChartX(index, layout);
      const tick = document.createElementNS(SVG_NS, 'text');
      tick.setAttribute('x', String(x));
      tick.setAttribute('y', String(layout.height - 6));
      tick.setAttribute('class', 'spline-axis-label spline-axis-label-x');
      tick.setAttribute('text-anchor', 'middle');
      tick.textContent = unit.id.slice(0, 3);
      tick.dataset.fullName = unit.name;
      gridLayer.appendChild(tick);
    });

    const points: ChartPoint[] = state.units.map((unit, index) => ({
      x: toChartX(index, layout),
      y: toChartY(unit[stat], layout),
    }));

    pathElement = document.createElementNS(SVG_NS, 'path');
    pathElement.setAttribute('d', catmullRomPath(points));
    pathElement.setAttribute('class', 'spline-path');
    pathElement.setAttribute('fill', 'none');
    pathElement.setAttribute('stroke', STAT_COLORS[stat]);
    pathElement.setAttribute('stroke-width', '2');
    pathElement.setAttribute('pointer-events', 'none');
    pathsLayer.appendChild(pathElement);

    state.units.forEach((unit, index) => {
      const x = toChartX(index, layout);
      const y = toChartY(unit[stat], layout);
      const selected = index === state.selectedIndex;

      const knot = document.createElementNS(SVG_NS, 'circle');
      knot.setAttribute('class', 'spline-knot');
      knot.setAttribute('cx', String(x));
      knot.setAttribute('cy', String(y));
      knot.setAttribute('r', selected ? '5' : '4');
      knot.setAttribute('fill', STAT_COLORS[stat]);
      knot.setAttribute('pointer-events', 'none');
      knotsLayer.appendChild(knot);
      knotElements[index] = knot;

      const hit = document.createElementNS(SVG_NS, 'circle');
      hit.setAttribute('class', 'spline-knot-hit');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y));
      hit.setAttribute('r', '9');
      hit.setAttribute('fill', 'transparent');
      hit.style.cursor = 'ns-resize';

      hit.addEventListener('pointerdown', (event) => startDrag(event, index));
      hit.addEventListener('mouseenter', () => {
        tooltip.hidden = false;
        tooltip.textContent = `${unit.name}: ${unit[stat]}`;
      });
      hit.addEventListener('mouseleave', () => {
        if (dragIndex !== index) {
          tooltip.hidden = true;
        }
      });

      knotsLayer.appendChild(hit);
      knotHitElements[index] = hit;
    });
  };

  subscribe(render);
  render();
}
