import { createUnitCatalog, type UnitCatalog } from '../units/catalog.js';
import { createUnitDataClient, type UnitDataClient, type UnitDataClientOptions } from '../units/client.js';
import type { AppPart, ServiceLocator } from '../locator/types.js';
import { ServiceTokens } from '../locator/tokens.js';

export function registerUnitCatalog(locator: ServiceLocator, part: AppPart): void {
  let catalog: UnitCatalog | undefined;
  locator.register(part, ServiceTokens.UnitCatalog, () => {
    catalog ??= createUnitCatalog();
    return catalog;
  });
}

export function registerUnitDataClient(
  locator: ServiceLocator,
  part: AppPart,
  options: UnitDataClientOptions = {},
): void {
  registerUnitCatalog(locator, part);
  locator.register(part, ServiceTokens.UnitData, () =>
    createUnitDataClient({
      ...options,
      catalog: locator.resolve<UnitCatalog>(part, ServiceTokens.UnitCatalog),
    }),
  );
}
