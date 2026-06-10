import type { UnitType } from '../types/domain.js';
import type { TurnActionOffer } from './turn-actions.js';

function hashSeed(...parts: Array<string | number>): number {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

export function pickRandomIndex(length: number, seed: number): number {
  if (length <= 0) {
    return 0;
  }
  let state = seed || 1;
  state = (Math.imul(state, 1103515245) + 12345) >>> 0;
  return state % length;
}

export function pickRandomUnitType(
  available: UnitType[],
  pickIndex: number,
  playerId: string,
): UnitType {
  if (available.length === 0) {
    throw new Error('No unit types available');
  }
  const index = pickRandomIndex(available.length, hashSeed('unit', pickIndex, playerId));
  return available[index]!;
}

export function pickRandomTurnAction(
  actions: TurnActionOffer[],
  turnIndex: number,
  playerId: string,
): TurnActionOffer | null {
  if (actions.length === 0) {
    return null;
  }
  const index = pickRandomIndex(actions.length, hashSeed('action', turnIndex, playerId));
  return actions[index] ?? null;
}

/** Bot picks with variety across turns (prefers add/upgrade when offered). */
export function pickBotTurnAction(
  actions: TurnActionOffer[],
  turnIndex: number,
  playerId: string,
): TurnActionOffer | null {
  if (actions.length === 0) {
    return null;
  }

  const weights = actions.map((action) => {
    const kind = action.actionId.split(':')[0];
    if (kind === 'add') {
      return 4;
    }
    if (kind === 'upgrade') {
      return 3;
    }
    if (kind === 'double') {
      return 2;
    }
    return 1;
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = pickRandomIndex(total, hashSeed('bot-action', turnIndex, playerId));
  for (let index = 0; index < actions.length; index++) {
    const weight = weights[index]!;
    if (roll < weight) {
      return actions[index]!;
    }
    roll -= weight;
  }
  return actions[actions.length - 1]!;
}

/** Bot submits up to `count` distinct actions from the offered pool. */
export function pickBotTurnActions(
  actions: TurnActionOffer[],
  turnIndex: number,
  playerId: string,
  count: number,
): TurnActionOffer[] {
  const picks: TurnActionOffer[] = [];
  let pool = [...actions];
  for (let pickIndex = 0; pickIndex < count && pool.length > 0; pickIndex++) {
    const pick = pickBotTurnAction(pool, turnIndex, `${playerId}:${pickIndex}`);
    if (!pick) {
      break;
    }
    picks.push(pick);
    pool = pool.filter((action) => action.actionId !== pick.actionId);
  }
  return picks;
}

export function pickBotUnitType(
  available: UnitType[],
  pickIndex: number,
  playerId: string,
): UnitType {
  const index = pickRandomIndex(
    available.length,
    hashSeed('bot-unit', pickIndex, playerId),
  );
  return available[index] ?? available[0]!;
}
