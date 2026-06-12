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
import { createUnitSpriteGroup, hasUnitSprite } from './unit-sprite.js';

function unitCatalog(): UnitCatalog {
  return resolveService(ServiceTokens.UnitCatalog);
}

function attackLineFlashMs(): number {
  return getCombatTuning().playback.attackLineFlashMs;
}

function unitEnterMs(): number {
  return getCombatTuning().playback.unitPresence.enterMs;
}

function unitExitMs(): number {
  return getCombatTuning().playback.unitPresence.exitMs;
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

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function chargeIconSpeedScale(): number {
  return getCombatTuning().playback.charge.iconSpeedScale;
}

function projectMotion(fieldX: number, fieldZ: number, heightM: number): { x: number; y: number } {
  const screen = projectWorldToScreen(fieldX, fieldZ, heightM);
  return { x: screen.screenX, y: screen.screenY };
}

const FIGHT_PLAYBACK_KINDS = new Set<PlaybackEvent['kind']>([
  'move',
  'attack',
  'heal',
  'death',
  'spawn',
]);

const PLAYBACK_KIND_ORDER: Partial<Record<NonNullable<PlaybackEvent['kind']>, number>> = {
  move: 0,
  attack: 1,
  heal: 2,
  death: 3,
  spawn: 4,
};

function comparePlaybackEvents(left: PlaybackEvent, right: PlaybackEvent): number {
  if (left.atMs !== right.atMs) {
    return left.atMs - right.atMs;
  }
  const leftOrder = PLAYBACK_KIND_ORDER[left.kind ?? 'move'] ?? 99;
  const rightOrder = PLAYBACK_KIND_ORDER[right.kind ?? 'move'] ?? 99;
  return leftOrder - rightOrder;
}

function sliceFightPlayback(playback: PlaybackEvent[], fightStartMs: number): PlaybackEvent[] {
  return playback
    .filter((event) => event.atMs >= fightStartMs && FIGHT_PLAYBACK_KINDS.has(event.kind))
    .sort(comparePlaybackEvents);
}

function fightPlaybackEndMs(playback: PlaybackEvent[], startMs: number): number {
  return playback.reduce((max, event) => Math.max(max, event.atMs), startMs);
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
  const unitUsesSprite = new Set<string>();
  const unitVisualCache = new Map<string, { level: number; hp: number; scale: number }>();
  const unitVisualOffsets = new Map<string, number>();
  const unitPresenceScale = new Map<string, number>();
  const unitLastDisplay = new Map<string, { x: number; y: number; chargeSpeed?: number }>();
  const presenceAnimFrames = new Map<string, number>();
  const exitingUnitIds = new Set<string>();
  const attackLineTimers = new Set<number>();
  let unitsById = new Map<string, CombatUnit>();
  let playbackRoster: CombatUnit[] = [];
  let playbackActive = false;

  function cancelPresenceAnimation(unitId: string): void {
    const frameId = presenceAnimFrames.get(unitId);
    if (frameId !== undefined) {
      window.cancelAnimationFrame(frameId);
      presenceAnimFrames.delete(unitId);
    }
  }

  function rerenderUnitAtLastDisplay(unitId: string): void {
    const unit = unitsById.get(unitId);
    const display = unitLastDisplay.get(unitId);
    if (!unit || !display) {
      return;
    }
    renderUnit(unit, false, display);
  }

  function startPresenceAnimation(
    unitId: string,
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void,
  ): void {
    cancelPresenceAnimation(unitId);
    unitPresenceScale.set(unitId, from);
    rerenderUnitAtLastDisplay(unitId);

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
      const eased = to > from ? easeOutCubic(t) : easeInQuad(t);
      unitPresenceScale.set(unitId, lerp(from, to, eased));
      rerenderUnitAtLastDisplay(unitId);

      if (t < 1) {
        presenceAnimFrames.set(unitId, window.requestAnimationFrame(tick));
        return;
      }

      presenceAnimFrames.delete(unitId);
      if (to === 0) {
        unitPresenceScale.delete(unitId);
        onComplete?.();
        return;
      }
      unitPresenceScale.set(unitId, 1);
    };

    presenceAnimFrames.set(unitId, window.requestAnimationFrame(tick));
  }

  function animateUnitEnter(unitId: string): void {
    startPresenceAnimation(unitId, 0, 1, unitEnterMs());
  }

  function animateUnitExit(unitId: string, onComplete: () => void): void {
    exitingUnitIds.add(unitId);
    const current = unitPresenceScale.get(unitId) ?? 1;
    startPresenceAnimation(unitId, current, 0, unitExitMs(), () => {
      exitingUnitIds.delete(unitId);
      onComplete();
    });
  }

  function finalizePlaybackVisuals(): void {
    for (const unitId of presenceAnimFrames.keys()) {
      cancelPresenceAnimation(unitId);
    }
    exitingUnitIds.clear();
    for (const [unitId, unit] of unitsById.entries()) {
      if (unit.hp <= 0) {
        removeUnit(unitId);
        continue;
      }
      unitPresenceScale.set(unitId, 1);
      rerenderUnitAtLastDisplay(unitId);
    }
  }

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
    const usesSprite = unitUsesSprite.has(unit.unitId);
    if (!group || (!usesSprite && !shape)) {
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'combat-unit');
      group.dataset.unitId = unit.unitId;
      if (hasUnitSprite(unit.unitType)) {
        const sprite = createUnitSpriteGroup(unit.unitType);
        if (sprite) {
          group.appendChild(sprite);
          unitUsesSprite.add(unit.unitId);
        }
      }
      if (!unitUsesSprite.has(unit.unitId)) {
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', getUnitIconPath(unit.unitType));
        shape.setAttribute('paint-order', 'stroke fill');
        shape.setAttribute('stroke-width', String(UNIT_ICON_STROKE_WIDTH));
        group.appendChild(shape);
        unitPaths.set(unit.unitId, shape);
      }
      unitsLayer.appendChild(group);
      unitElements.set(unit.unitId, group);
      unitVisualCache.delete(unit.unitId);
    }

    const projected = display ?? projectMotion(unit.x, unit.y, 0);
    const cx = toSvgX(projected.x);
    const cy = toSvgY(projected.y);
    const radius = unitRadius(unit);
    const chargeSpeed = display?.chargeSpeed ?? 0;
    const presenceScale = unitPresenceScale.get(unit.unitId) ?? 1;
    const iconScale =
      getUnitIconScale(radius) * (1 + chargeSpeed * chargeIconSpeedScale()) * presenceScale;
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;

    group.style.transition = 'none';
    group.style.transform = '';
    group.setAttribute(
      'transform',
      `translate(${cx} ${cy}) scale(${iconScale}) translate(${-UNIT_ICON_SIZE / 2} ${-UNIT_ICON_SIZE / 2})`,
    );

    const definition = unitCatalog().getUnitDefinition(unit.unitType);
    if (unitUsesSprite.has(unit.unitId)) {
      group.setAttribute('class', isCriticalHealth(hpRatio) ? 'combat-unit combat-unit-critical' : 'combat-unit');
    } else if (shape) {
      shape.setAttribute('fill', resolveUnitFillColor(definition, unit.level));
      shape.setAttribute('stroke', getHealthBorderColor(hpRatio));
      if (isCriticalHealth(hpRatio)) {
        shape.setAttribute('class', 'combat-unit-critical');
      } else {
        shape.removeAttribute('class');
      }
    }

    unitVisualCache.set(unit.unitId, { level: unit.level, hp: unit.hp, scale: iconScale });
    unitLastDisplay.set(unit.unitId, { x: projected.x, y: projected.y, chargeSpeed });
  }

  function applyHealFromEvent(event: PlaybackEvent): void {
    if (event.kind !== 'heal' || !event.targetUnitId || event.healAmount === undefined) {
      return;
    }
    const target = unitsById.get(event.targetUnitId);
    if (!target) {
      return;
    }
    target.hp = Math.min(target.maxHp, target.hp + event.healAmount);
    renderUnit(target, false, projectMotion(target.x, target.y, 0));
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
    cancelPresenceAnimation(unitId);
    const group = unitElements.get(unitId);
    if (group) {
      group.remove();
      unitElements.delete(unitId);
      unitPaths.delete(unitId);
      unitUsesSprite.delete(unitId);
      unitVisualCache.delete(unitId);
    }
    unitsById.delete(unitId);
    unitVisualOffsets.delete(unitId);
    unitPresenceScale.delete(unitId);
    unitLastDisplay.delete(unitId);
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
    const isHeal = event.playbackBeam === 'heal';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const classes = ['attack-line'];
    if (animate) {
      classes.push('attack-line-projectile');
    }
    if (isHeal) {
      classes.push('attack-line-heal');
    }
    line.setAttribute('class', classes.join(' '));
    if (event.playbackColor) {
      line.style.stroke = event.playbackColor;
    }
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
    const isHeal = event.playbackBeam === 'heal';
    const burst = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    burst.setAttribute('class', isHeal ? 'attack-burst attack-burst-heal' : 'attack-burst');
    if (event.playbackColor) {
      burst.style.fill = event.playbackColor;
    }
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

  function renderHeal(event: PlaybackEvent, motionTracks: Map<string, MoveKeyframe[]>): void {
    drawAttackLine(event, event.durationMs && event.durationMs > 0 ? event.durationMs : attackLineFlashMs(), motionTracks);
  }

  function renderAttack(event: PlaybackEvent, motionTracks: Map<string, MoveKeyframe[]>): void {
    if (event.playbackBeam === 'heal') {
      renderHeal(event, motionTracks);
      return;
    }
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

    if (event.kind === 'heal') {
      applyHealFromEvent(event);
      renderHeal(event, motionTracks);
    }

    if (event.kind === 'death' && event.sourceUnitId) {
      const unitId = event.sourceUnitId;
      motionTracks.delete(unitId);
      if (!unitsById.has(unitId)) {
        return;
      }
      animateUnitExit(unitId, () => removeUnit(unitId));
    }

    if (event.kind === 'spawn' && event.sourceUnitId) {
      const rosterUnit = playbackRoster.find((unit) => unit.unitId === event.sourceUnitId);
      if (!rosterUnit) {
        return;
      }
      const unit: CombatUnit = {
        ...rosterUnit,
        x: event.x ?? rosterUnit.x,
        y: event.y ?? rosterUnit.y,
      };
      cancelPresenceAnimation(unit.unitId);
      unitsById.set(unit.unitId, unit);
      const display = projectMotion(unit.x, unit.y, event.height ?? 0);
      unitPresenceScale.set(unit.unitId, 0);
      renderUnit(unit, false, display);
      animateUnitEnter(unit.unitId);
      motionTracks.set(unit.unitId, [
        {
          atMs: event.atMs,
          x: unit.x,
          y: unit.y,
          height: event.height ?? 0,
          movementType: unitCatalog().getUnitDefinition(unit.unitType).movementType,
        },
      ]);
    }
  }

  function updateUnitMotionPositions(
    simMs: number,
    motionTracks: Map<string, MoveKeyframe[]>,
  ): void {
    for (const unit of unitsById.values()) {
      if (exitingUnitIds.has(unit.unitId)) {
        rerenderUnitAtLastDisplay(unit.unitId);
        continue;
      }
      const track = motionTracks.get(unit.unitId);
      if (!track) {
        renderUnit(unit, false, projectMotion(unit.x, unit.y, 0));
        continue;
      }
      const sample = sampleMotion(track, simMs);
      renderUnit(unit, false, { x: sample.x, y: sample.y, chargeSpeed: sample.chargeSpeed });
    }
  }

  function syncField(units: CombatUnit[], options?: { animateEnter?: boolean }): void {
    const previousIds = new Set(unitsById.keys());
    unitsById = new Map(units.map((unit) => [unit.unitId, { ...unit }]));
    const liveIds = new Set(unitsById.keys());
    for (const unitId of unitElements.keys()) {
      if (!liveIds.has(unitId)) {
        cancelPresenceAnimation(unitId);
        unitElements.get(unitId)?.remove();
        unitElements.delete(unitId);
        unitPaths.delete(unitId);
        unitUsesSprite.delete(unitId);
        unitVisualCache.delete(unitId);
        unitPresenceScale.delete(unitId);
        unitLastDisplay.delete(unitId);
      }
    }
    const animateEnter = options?.animateEnter ?? true;
    for (const unit of unitsById.values()) {
      const isNew = !previousIds.has(unit.unitId);
      renderUnit(unit, false, projectMotion(unit.x, unit.y, 0));
      if (animateEnter && isNew) {
        unitPresenceScale.set(unit.unitId, 0);
        rerenderUnitAtLastDisplay(unit.unitId);
        animateUnitEnter(unit.unitId);
      }
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
      syncField(units, { animateEnter: false });
      if (fightPlayback.length === 0) {
        finishPlayback();
        return Promise.resolve();
      }

      const startMs = fightStartMs;
      const endMs = fightPlaybackEndMs(fightPlayback, startMs);
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
              finalizePlaybackVisuals();
              finishPlayback();
              resolve();
            }, Math.max(attackLineFlashMs(), unitExitMs()));
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
      for (const unitId of presenceAnimFrames.keys()) {
        cancelPresenceAnimation(unitId);
      }
      exitingUnitIds.clear();
      playbackRoster = [];
      linesLayer.replaceChildren();
      unitElements.forEach((element) => element.remove());
      unitElements.clear();
      unitPaths.clear();
      unitUsesSprite.clear();
      unitVisualCache.clear();
      unitVisualOffsets.clear();
      unitPresenceScale.clear();
      unitLastDisplay.clear();
      unitsById.clear();
    },
  };
}
