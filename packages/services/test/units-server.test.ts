import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createUnitDataServer } from '../src/units/server.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('createUnitDataServer', () => {
  it('loads units from data/units.json', async () => {
    const server = await createUnitDataServer({ repoRoot });
    const units = server.loadUnits();
    expect(units.length).toBeGreaterThan(0);
    expect(units[0]?.id).toBeTruthy();
  });

  it('rejects invalid payloads on save', async () => {
    const server = await createUnitDataServer({ repoRoot });
    const result = server.saveUnits([{ id: 'INVALID' }] as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
