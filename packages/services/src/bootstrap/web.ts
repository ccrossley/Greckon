import type { ServiceLocator } from '../locator/types.js';
import { AppPart } from '../locator/types.js';
import { registerUnitCatalog } from './units.js';

export function registerWebServices(locator: ServiceLocator): void {
  registerUnitCatalog(locator, AppPart.Web);
}
