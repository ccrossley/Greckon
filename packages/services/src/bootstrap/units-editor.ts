import type { ServiceLocator } from '../locator/types.js';
import { AppPart } from '../locator/types.js';
import { registerUnitDataClient } from './units.js';
import type { UnitDataClientOptions } from '../units/client.js';

export function registerUnitsEditorServices(
  locator: ServiceLocator,
  options: UnitDataClientOptions = {},
): void {
  registerUnitDataClient(locator, AppPart.UnitsEditor, options);
}
