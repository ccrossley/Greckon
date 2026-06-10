import type { CombatUnit, TurnActionKind, UnitType } from '../types/domain.js';
import { getUnitDefinition, getUnitDisplayName } from '../game-data/index.js';
import { loadGameConfig } from '../config/index.js';
import { MAX_UNIT_LEVEL } from './visual.js';

export interface ParsedTurnAction {
  kind: TurnActionKind;
  unitType: UnitType;
}

export interface TurnActionOffer {
  unitId: string;
  actionId: string;
  label: string;
}

const ACTION_KINDS: TurnActionKind[] = ['upgrade', 'double', 'add'];

const KIND_LABELS: Record<TurnActionKind, string> = {
  upgrade: 'Upgrade',
  double: 'Double',
  add: 'Add',
};

/** Offer roll weights — add common, upgrade uncommon, double rare. */
export const ACTION_KIND_OFFER_WEIGHT: Record<TurnActionKind, number> = {
  add: 4,
  upgrade: 2,
  double: 1,
};

export function formatTurnActionId(kind: TurnActionKind, unitType: UnitType): string {
  return `${kind}:${unitType}`;
}

export function parseTurnActionId(actionId: string): ParsedTurnAction | null {
  const [kind, unitType] = actionId.split(':') as [TurnActionKind | undefined, UnitType | undefined];
  if (!kind || !unitType || !ACTION_KINDS.includes(kind)) {
    return null;
  }
  try {
    getUnitDefinition(unitType);
  } catch {
    return null;
  }
  return { kind, unitType };
}

function livingUnitsOfType(units: CombatUnit[], playerId: string, unitType: UnitType): CombatUnit[] {
  return units.filter((unit) => unit.playerId === playerId && unit.hp > 0 && unit.unitType === unitType);
}

export function isTurnActionValid(
  kind: TurnActionKind,
  unitType: UnitType,
  units: CombatUnit[],
  playerId: string,
  allowedUnitTypes?: UnitType[],
): boolean {
  if (allowedUnitTypes && !allowedUnitTypes.includes(unitType)) {
    return false;
  }
  const owned = livingUnitsOfType(units, playerId, unitType);
  switch (kind) {
    case 'upgrade': {
      const ofType = livingUnitsOfType(units, playerId, unitType);
      if (ofType.length === 0) {
        return false;
      }
      const typeLevel = Math.max(...ofType.map((unit) => unit.level));
      return typeLevel < MAX_UNIT_LEVEL;
    }
    case 'double':
      return owned.length >= 1;
    case 'add':
      return true;
    default:
      return false;
  }
}

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

function pickRandomIndex(length: number, seed: number): number {
  if (length <= 0) {
    return 0;
  }
  let state = seed || 1;
  state = (Math.imul(state, 1103515245) + 12345) >>> 0;
  return state % length;
}

function actionKey(candidate: { kind: TurnActionKind; unitType: UnitType }): string {
  return formatTurnActionId(candidate.kind, candidate.unitType);
}

function pickWeightedActionCandidates(
  candidates: Array<{ kind: TurnActionKind; unitType: UnitType }>,
  count: number,
  seed: number,
): Array<{ kind: TurnActionKind; unitType: UnitType }> {
  const pool = [...candidates];
  const picked: Array<{ kind: TurnActionKind; unitType: UnitType }> = [];
  let rollSeed = seed;

  while (picked.length < count && pool.length > 0) {
    const weights = pool.map((candidate) => ACTION_KIND_OFFER_WEIGHT[candidate.kind]);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = pickRandomIndex(total, rollSeed);
    rollSeed = (Math.imul(rollSeed, 1103515245) + 12345) >>> 0;

    let chosenIndex = pool.length - 1;
    for (let index = 0; index < pool.length; index++) {
      const weight = weights[index]!;
      if (roll < weight) {
        chosenIndex = index;
        break;
      }
      roll -= weight;
    }

    picked.push(pool[chosenIndex]!);
    pool.splice(chosenIndex, 1);
  }

  return picked;
}

export function buildPlayerTurnActions(
  turnIndex: number,
  playerId: string,
  units: CombatUnit[],
  draftUnitTypes: UnitType[],
  offerCount = loadGameConfig().roundActionOfferCount,
): TurnActionOffer[] {
  const candidateTypes = [...new Set(draftUnitTypes)];
  const candidates: Array<{ kind: TurnActionKind; unitType: UnitType }> = [];

  for (const unitType of candidateTypes) {
    for (const kind of ACTION_KINDS) {
      if (isTurnActionValid(kind, unitType, units, playerId, draftUnitTypes)) {
        candidates.push({ kind, unitType });
      }
    }
  }

  const unique = candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => actionKey(other) === actionKey(candidate)) === index,
  );

  const offers = pickWeightedActionCandidates(
    unique,
    Math.min(offerCount, unique.length),
    hashSeed('offer', turnIndex, playerId),
  );

  return offers.map(({ kind, unitType }) => ({
    unitId: 'squad',
    actionId: formatTurnActionId(kind, unitType),
    label: `${KIND_LABELS[kind]} ${getUnitDisplayName(unitType)}`,
  }));
}

/** @deprecated use buildPlayerTurnActions */
export function buildTurnActions(turnUnitTypes: UnitType[]): TurnActionOffer[] {
  const actions: TurnActionOffer[] = [];
  for (const unitType of turnUnitTypes) {
    const name = getUnitDisplayName(unitType);
    for (const kind of ACTION_KINDS) {
      actions.push({
        unitId: 'squad',
        actionId: formatTurnActionId(kind, unitType),
        label: `${KIND_LABELS[kind]} ${name}`,
      });
    }
  }
  return actions;
}
