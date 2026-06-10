import type { CombatUnit, PlaybackEvent } from '@greckon/core';
import {
  getCombatTuning,
  getHealthBorderColor,
  projectWorldToScreen,
  getUnitIconPath,
  getUnitIconScale,
  getUnitVisualScale,
  isCriticalHealth,
  resolveUnitFillColor,
  UNIT_ICON_SIZE,
  UNIT_ICON_STROKE_WIDTH,
  UNIT_VISUAL_RADIUS,
} from '@greckon/core';
import { resolveService, ServiceTokens } from '@greckon/services';
import type { UnitCatalog } from '@greckon/services/units';

function unitCatalog(): UnitCatalog {
  return resolveService(ServiceTokens.UnitCatalog);
}

function attackLineFlashMs(): number {
  return getCombatTuning().playback.attackLineFlashMs;
}

interface MoveKeyframe {
  atMs: number;
  x: number;
  y: number;
  height?: number;
  movementType?: PlaybackEvent['movementType'];
  chargeSpeed?: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function chargeIconSpeedScale(): number {
  return getCombatTuning().playback.charge.iconSpeedScale;
}

function projectMotion(fieldX: number, fieldZ: number, heightM: number): { x: number; y: number } {
  const screen = projectWorldToScreen(fieldX, fieldZ, heightM);
  return { x: screen.screenX, y: screen.screenY };
}

const FIGHT_PLAYBACK_KINDS = new Set<PlaybackEvent['kind']>(['move', 'attack', 'death']);

function sliceFightPlayback(playback: PlaybackEvent[], fightStartMs: number): PlaybackEvent[] {
  return playback.filter(
    (event) => event.atMs >= fightStartMs && FIGHT_PLAYBACK_KINDS.has(event.kind),
  );
}

function buildMotionTracks(
  units: CombatUnit[],
  playback: PlaybackEvent[],
  anchorMs: number,
): Map<string, MoveKeyframe[]> {
  const tracks = new Map<string, MoveKeyframe[]>();
  for (const unit of units) {
    tracks.set(unit.unitId, [
      {
        atMs: anchorMs,
        x: unit.x,
        y: unit.y,
        height: 0,
        movementType: unitCatalog().getUnitDefinition(unit.unitType).movementType,
      },
    ]);
  }

  for (const event of playback) {
    if (
      event.kind !== 'move' ||
      !event.sourceUnitId ||
      event.x === undefined ||
      event.y === undefined
    ) {
      continue;
    }
    const track = tracks.get(event.sourceUnitId) ?? [{ atMs: anchorMs, x: event.x, y: event.y }];
    track.push({
      atMs: event.atMs,
      x: event.x,
      y: event.y,
      height: event.height,
      movementType: event.movementType,
      chargeSpeed: event.chargeSpeed,
    });
    tracks.set(event.sourceUnitId, track);
  }

  for (const track of tracks.values()) {
    track.sort((left, right) => left.atMs - right.atMs);
  }

  return tracks;
}

function sampleMotion(track: MoveKeyframe[], simMs: number): {
  x: number;
  y: number;
  chargeSpeed: number;
} {
  if (track.length === 0) {
    return { x: 0.5, y: 0.5, chargeSpeed: 0 };
  }

  const first = track[0]!;
  if (simMs <= first.atMs) {
    const projected = projectMotion(first.x, first.y, first.height ?? 0);
    return { x: projected.x, y: projected.y, chargeSpeed: first.chargeSpeed ?? 0 };
  }

  const last = track[track.length - 1]!;
  if (simMs >= last.atMs) {
    const projected = projectMotion(last.x, last.y, last.height ?? 0);
    return { x: projected.x, y: projected.y, chargeSpeed: last.chargeSpeed ?? 0 };
  }

  for (let index = 0; index < track.length - 1; index++) {
    const from = track[index]!;
    const to = track[index + 1]!;
    if (simMs < from.atMs || simMs > to.atMs) {
      continue;
    }

    const span = Math.max(1, to.atMs - from.atMs);
    const t = (simMs - from.atMs) / span;
    const movementType = to.movementType ?? from.movementType;
    const eased = movementType === 'charge' ? easeOutQuad(t) : t;
    const fieldX = lerp(from.x, to.x, eased);
    const fieldZ = lerp(from.y, to.y, eased);
    const height = lerp(from.height ?? 0, to.height ?? 0, eased);
    const projected = projectMotion(fieldX, fieldZ, height);
    return {
      x: projected.x,
      y: projected.y,
      chargeSpeed: lerp(from.chargeSpeed ?? 0, to.chargeSpeed ?? 0, eased),
    };
  }

  const projected = projectMotion(last.x, last.y, last.height ?? 0);
  return { x: projected.x, y: projected.y, chargeSpeed: last.chargeSpeed ?? 0 };
}

export interface CombatArena {
  show(): void;
  hide(): void;
  showField(units: CombatUnit[]): void;
  playOutcome(
    units: CombatUnit[],
    playback: PlaybackEvent[],
    durationMs: number,
    options?: { fightStartMs?: number },
  ): Promise<void>;
  clear(): void;
  isPlaybackActive(): boolean;
}

export function createCombatArena(root: HTMLElement): CombatArena {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'combat-arena-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const field = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  field.setAttribute('class', 'combat-field');
  field.setAttribute('x', '0');
  field.setAttribute('y', '0');
  field.setAttribute('width', '100');
  field.setAttribute('height', '100');
  svg.appendChild(field);

  const unitsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  unitsLayer.setAttribute('class', 'units-layer');
  svg.appendChild(unitsLayer);

  const linesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  linesLayer.setAttribute('class', 'lines-layer');
  svg.appendChild(linesLayer);

  root.appendChild(svg);

  const unitElements = new Map<string, SVGGElement>();
  const unitPaths = new Map<string, SVGPathElement>();
  const unitVisualCache = new Map<string, { level: number; hp: number; scale: number }>();
  const unitVisualOffsets = new Map<string, number>();
  const attackLineTimers = new Set<number>();
  let unitsById = new Map<string, CombatUnit>();
  let playbackRoster: CombatUnit[] = [];
  let playbackActive = false;

  function finishPlayback(): void {
    playbackActive = false;
  }

  function toSvgX(x: number): number {
    return x * 100;
  }

  function toSvgY(y: number): number {
    return y * 100;
  }

  function unitRadius(unit: CombatUnit): number {
    return UNIT_VISUAL_RADIUS * getUnitVisualScale(unit.level);
  }

  function renderUnit(
    unit: CombatUnit,
    _animateMovement = false,
    display?: { x: number; y: number; chargeSpeed?: number },
  ): void {
    let group = unitElements.get(unit.unitId);
    let shape = unitPaths.get(unit.unitId);
    if (!group || !shape) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'combat-unit');
      group.dataset.unitId = unit.unitId;
      shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', getUnitIconPath(unit.unitType));
      shape.setAttribute('paint-order', 'stroke fill');
      shape.setAttribute('stroke-width', String(UNIT_ICON_STROKE_WIDTH));
      group.appendChild(shape);
      unitsLayer.appendChild(group);
      unitElements.set(unit.unitId, group);
      unitPaths.set(unit.unitId, shape);
      unitVisualCache.delete(unit.unitId);
    }

    const projected = display ?? projectMotion(unit.x, unit.y, 0);
    const cx = toSvgX(projected.x);
    const cy = toSvgY(projected.y);
    const radius = unitRadius(unit);
    const chargeSpeed = display?.chargeSpeed ?? 0;
    const iconScale = getUnitIconScale(radius) * (1 + chargeSpeed * chargeIconSpeedScale());
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;

    group.style.transition = 'none';
    group.style.transform = '';
    group.setAttribute(
      'transform',
      `translate(${cx} ${cy}) scale(${iconScale}) translate(${-UNIT_ICON_SIZE / 2} ${-UNIT_ICON_SIZE / 2})`,
    );

    const definition = unitCatalog().getUnitDefinition(unit.unitType);
    shape.setAttribute('fill', resolveUnitFillColor(definition, unit.level));
    shape.setAttribute('stroke', getHealthBorderColor(hpRatio));
    if (isCriticalHealth(hpRatio)) {
      shape.setAttribute('class', 'combat-unit-critical');
    } else {
      shape.removeAttribute('class');
    }

    unitVisualCache.set(unit.unitId, { level: unit.level, hp: unit.hp, scale: iconScale });
  }

  function applyDamageFromAttack(event: PlaybackEvent): void {
    if (event.kind !== 'attack' || !event.targetUnitId || event.damage === undefined) {
      return;
    }
    const isProjectileLaunch =
      event.attackType === 'projectile' &&
      event.travelTimeMs !== undefined &&
      event.durationMs !== undefined &&
      event.durationMs >= event.travelTimeMs;
    if (isProjectileLaunch) {
      return;
    }
    const target = unitsById.get(event.targetUnitId);
    if (!target) {
      return;
    }
    target.hp = Math.max(0, target.hp - event.damage);
  }

  function removeUnit(unitId: string): void {
    const group = unitElements.get(unitId);
    if (group) {
      group.remove();
      unitElements.delete(unitId);
      unitPaths.delete(unitId);
      unitVisualCache.delete(unitId);
    }
    unitsById.delete(unitId);
    unitVisualOffsets.delete(unitId);
  }

  function resolveScreenPoint(
    event: PlaybackEvent,
    end: 'from' | 'to',
    atMs: number,
    motionTracks: Map<string, MoveKeyframe[]>,
  ): { x: number; y: number } | null {
    const unitId = end === 'from' ? event.sourceUnitId : event.targetUnitId;
    if (unitId) {
      const track = motionTracks.get(unitId);
      if (track) {
        const sample = sampleMotion(track, atMs);
        return { x: sample.x, y: sample.y };
      }
    }
    const fieldX = end === 'from' ? event.x : event.x2;
    const fieldZ = end === 'from' ? event.y : event.y2;
    if (fieldX === undefined || fieldZ === undefined) {
      return null;
    }
    const height = end === 'from' ? (event.height ?? 0) : 0;
    return projectMotion(fieldX, fieldZ, height);
  }

  function drawAttackLine(
    event: PlaybackEvent,
    durationMs: number,
    motionTracks: Map<string, MoveKeyframe[]>,
    animate = false,
  ): void {
    const from = resolveScreenPoint(event, 'from', event.atMs, motionTracks);
    const to = resolveScreenPoint(event, 'to', event.atMs, motionTracks);
    if (!from || !to) {
      return;
    }
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', animate ? 'attack-line attack-line-projectile' : 'attack-line');
    line.setAttribute('x1', String(toSvgX(from.x)));
    line.setAttribute('y1', String(toSvgY(from.y)));
    line.setAttribute('x2', String(toSvgX(to.x)));
    line.setAttribute('y2', String(toSvgY(to.y)));
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    if (animate && durationMs > 0) {
      line.style.setProperty('--travel-ms', String(durationMs));
    }
    linesLayer.appendChild(line);

    const timer = window.setTimeout(() => {
      line.remove();
      attackLineTimers.delete(timer);
    }, durationMs);
    attackLineTimers.add(timer);
  }

  function drawInstantBurst(
    event: PlaybackEvent,
    motionTracks: Map<string, MoveKeyframe[]>,
  ): void {
    const point = resolveScreenPoint(event, 'to', event.atMs, motionTracks);
    if (!point) {
      return;
    }
    const burst = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    burst.setAttribute('class', 'attack-burst');
    burst.setAttribute('cx', String(toSvgX(point.x)));
    burst.setAttribute('cy', String(toSvgY(point.y)));
    burst.setAttribute('r', '1');
    linesLayer.appendChild(burst);
    const timer = window.setTimeout(() => {
      burst.remove();
      attackLineTimers.delete(timer);
    }, attackLineFlashMs());
    attackLineTimers.add(timer);
  }

  function renderAttack(event: PlaybackEvent, motionTracks: Map<string, MoveKeyframe[]>): void {
    const attackType = event.attackType ?? 'instant';
    if (attackType === 'line' || attackType === 'multi') {
      const flashMs = event.durationMs && event.durationMs > 0 ? event.durationMs : attackLineFlashMs();
      drawAttackLine(event, flashMs, motionTracks);
      return;
    }
    if (attackType === 'projectile') {
      const travelMs = event.travelTimeMs && event.travelTimeMs > 0 ? event.travelTimeMs : attackLineFlashMs();
      drawAttackLine(event, travelMs, motionTracks, true);
      return;
    }
    drawInstantBurst(event, motionTracks);
  }

  function applyTimelineFrame(
    event: PlaybackEvent,
    motionTracks: Map<string, MoveKeyframe[]>,
  ): void {
    if (event.kind === 'move') {
      return;
    }

    if (event.kind === 'attack') {
      applyDamageFromAttack(event);
      renderAttack(event, motionTracks);
    }

    if (event.kind === 'death' && event.sourceUnitId) {
      removeUnit(event.sourceUnitId);
      motionTracks.delete(event.sourceUnitId);
    }
  }

  function updateUnitMotionPositions(
    simMs: number,
    motionTracks: Map<string, MoveKeyframe[]>,
  ): void {
    for (const unit of unitsById.values()) {
      const track = motionTracks.get(unit.unitId);
      if (!track) {
        renderUnit(unit, false, projectMotion(unit.x, unit.y, 0));
        continue;
      }
      const sample = sampleMotion(track, simMs);
      renderUnit(unit, false, { x: sample.x, y: sample.y, chargeSpeed: sample.chargeSpeed });
    }
  }

  function syncField(units: CombatUnit[]): void {
    unitsById = new Map(units.map((unit) => [unit.unitId, { ...unit }]));
    const liveIds = new Set(unitsById.keys());
    for (const unitId of unitElements.keys()) {
      if (!liveIds.has(unitId)) {
        unitElements.get(unitId)?.remove();
        unitElements.delete(unitId);
        unitPaths.delete(unitId);
        unitVisualCache.delete(unitId);
      }
    }
    for (const unit of unitsById.values()) {
      renderUnit(unit, false, projectMotion(unit.x, unit.y, 0));
    }
  }

  return {
    show() {
      root.hidden = false;
    },

    hide() {
      root.hidden = true;
      this.clear();
    },

    showField(units) {
      if (playbackActive) {
        return;
      }
      syncField(units);
    },

    isPlaybackActive() {
      return playbackActive;
    },

    playOutcome(units, playback, durationMs, options) {
      playbackActive = true;
      playbackRoster = units.map((unit) => ({ ...unit }));
      const fightStartMs = options?.fightStartMs ?? playback[0]?.atMs ?? 0;
      const fightPlayback = sliceFightPlayback(playback, fightStartMs);
      syncField(units);
      if (fightPlayback.length === 0) {
        finishPlayback();
        return Promise.resolve();
      }

      const startMs = fightStartMs;
      const endMs = fightPlayback[fightPlayback.length - 1]!.atMs;
      const span = Math.max(1, endMs - startMs);
      const wallStart = performance.now();
      const motionTracks = buildMotionTracks(units, fightPlayback, fightStartMs);
      updateUnitMotionPositions(fightStartMs, motionTracks);

      return new Promise((resolve) => {
        let frameIndex = 0;

        const step = () => {
          const elapsed = performance.now() - wallStart;
          const simMs = startMs + (elapsed / durationMs) * span;

          while (frameIndex < fightPlayback.length && fightPlayback[frameIndex]!.atMs <= simMs) {
            applyTimelineFrame(fightPlayback[frameIndex]!, motionTracks);
            frameIndex += 1;
          }

          updateUnitMotionPositions(simMs, motionTracks);

          if (frameIndex >= fightPlayback.length && simMs >= endMs) {
            updateUnitMotionPositions(endMs, motionTracks);
            window.setTimeout(() => {
              finishPlayback();
              resolve();
            }, attackLineFlashMs());
            return;
          }
          window.requestAnimationFrame(step);
        };

        window.requestAnimationFrame(step);
      });
    },

    clear() {
      for (const timer of attackLineTimers) {
        window.clearTimeout(timer);
      }
      attackLineTimers.clear();
      playbackRoster = [];
      linesLayer.replaceChildren();
      unitElements.forEach((element) => element.remove());
      unitElements.clear();
      unitPaths.clear();
      unitVisualCache.clear();
      unitVisualOffsets.clear();
      unitsById.clear();
    },
  };
}
