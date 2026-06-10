import type { Unit } from './types.js';
import { createUnitCatalog, type UnitCatalog } from './catalog.js';

export type { Unit, UnitCatalog, UnitDefinition, UnitType } from './catalog.js';
export { createUnitCatalog } from './catalog.js';

export interface UnitDataClientOptions {
  /** API origin; empty string uses relative URLs (typical in Vite dev). */
  baseUrl?: string;
  apiPath?: string;
  /** Shared catalog instance (e.g. from the service locator). */
  catalog?: UnitCatalog;
}

export interface UnitDataClient {
  /** Compiled catalog from the last codegen build. */
  catalog: UnitCatalog;
  loadUnits(): Promise<Unit[]>;
  saveUnits(units: Unit[]): Promise<void>;
}

export function createUnitDataClient(options: UnitDataClientOptions = {}): UnitDataClient {
  const baseUrl = options.baseUrl ?? '';
  const apiPath = options.apiPath ?? '/api/units';
  const url = `${baseUrl}${apiPath}`;

  const catalog = options.catalog ?? createUnitCatalog();

  return {
    catalog,
    async loadUnits() {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load units (${response.status})`);
      }
      return response.json() as Promise<Unit[]>;
    },
    async saveUnits(units) {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(units),
      });
      const payload = (await response.json()) as { ok?: boolean; errors?: string[] };
      if (!response.ok || !payload.ok) {
        const detail = payload.errors?.join('; ') ?? `HTTP ${response.status}`;
        throw new Error(detail);
      }
    },
  };
}
