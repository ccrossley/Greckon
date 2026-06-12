import { describe, expect, it } from 'vitest';
import {
  AppPart,
  createServiceLocator,
  registerUnitCatalog,
  resolveService,
  ServiceTokens,
  setAppServices,
} from '../src/index.js';
import type { UnitCatalog } from '../src/units/catalog.js';

describe('ServiceLocator', () => {
  it('registers and resolves services for the same part', () => {
    const locator = createServiceLocator();
    const token = Symbol('config');
    locator.register(AppPart.Api, token, () => ({ port: 3000 }));
    expect(locator.resolve(AppPart.Api, token)).toEqual({ port: 3000 });
  });

  it('throws when resolving a token registered for a different part', () => {
    const locator = createServiceLocator();
    const token = Symbol('config');
    locator.register(AppPart.Api, token, () => ({ port: 3000 }));
    expect(() => locator.resolve(AppPart.CombatClient, token)).toThrow(/different part/i);
  });

  it('resolveService uses the active app part', () => {
    const locator = createServiceLocator();
    registerUnitCatalog(locator, AppPart.Web);
    setAppServices(locator, AppPart.Web);
    const catalog = resolveService<UnitCatalog>(ServiceTokens.UnitCatalog);
    expect(catalog.listUnitTypes()).toHaveLength(36);
  });
});
