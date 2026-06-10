import type { UnitType } from '../types/domain.js';

/** Unit types still available for secret draft (each type may be picked at most once). */
export function availableDraftUnitTypes(
  allTypes: readonly UnitType[],
  alreadyPicked: readonly UnitType[],
): UnitType[] {
  const picked = new Set(alreadyPicked);
  return allTypes.filter((type) => !picked.has(type));
}

export function isDraftUnitTypeAvailable(
  unitType: UnitType,
  alreadyPicked: readonly UnitType[],
): boolean {
  return !alreadyPicked.includes(unitType);
}
