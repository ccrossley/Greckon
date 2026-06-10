import {
  getUnitDefinition,
  getUnitDisplayName,
  listUnitTypes,
  type UnitDefinition,
  type UnitType,
} from '@greckon/core';

export type { Unit, UnitDefinition, UnitType } from './types.js';

/** Read-only view of the compiled unit catalog (browser and Node). */
export interface UnitCatalog {
  listUnitTypes(): UnitType[];
  getUnitDefinition(unitType: UnitType): UnitDefinition;
  getUnitDisplayName(unitType: UnitType): string;
}

export function createUnitCatalog(): UnitCatalog {
  return {
    listUnitTypes,
    getUnitDefinition,
    getUnitDisplayName,
  };
}
