import type { UnitType } from '@greckon/core';
import { pickBotUnitType } from '@greckon/core';

export async function runUnitPickPhase(
  available: UnitType[],
  pickIndex: number,
  playerId: string,
): Promise<UnitType> {
  return pickBotUnitType(available, pickIndex, playerId);
}
