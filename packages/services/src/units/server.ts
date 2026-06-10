import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Unit, SaveUnitsResult } from './types.js';

export type { Unit, SaveUnitsResult } from './types.js';
export { createUnitCatalog, type UnitCatalog } from './catalog.js';

type ValidateFn = ((data: unknown) => boolean) & { errors?: Array<{ instancePath?: string; message?: string }> };

export interface UnitDataServerOptions {
  repoRoot: string;
  unitsPath?: string;
  schemaPath?: string;
  compileUnitsScript?: string;
  compileIconsScript?: string;
}

export interface UnitDataServer {
  loadUnits(): Unit[];
  saveUnits(units: Unit[]): SaveUnitsResult;
}

async function loadValidator(repoRoot: string, schemaPath: string): Promise<ValidateFn> {
  const ajvPath = join(
    repoRoot,
    'node_modules/.pnpm/@redocly+ajv@8.11.2/node_modules/@redocly/ajv/dist/2020.js',
  );
  const { default: Ajv } = await import(pathToFileURL(ajvPath).href);
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  return ajv.compile(schema) as ValidateFn;
}

function resolvePaths(options: UnitDataServerOptions) {
  const repoRoot = options.repoRoot;
  return {
    unitsPath: options.unitsPath ?? join(repoRoot, 'data/units.json'),
    schemaPath: options.schemaPath ?? join(repoRoot, 'schemas/units/units.schema.json'),
    compileUnitsScript: options.compileUnitsScript ?? join(repoRoot, 'scripts/compile-units.mjs'),
    compileIconsScript: options.compileIconsScript ?? join(repoRoot, 'scripts/compile-unit-icons.mjs'),
  };
}

function validateUnits(validate: ValidateFn, units: unknown): string[] | null {
  if (!validate(units)) {
    return validate.errors?.map((error) => `${error.instancePath ?? ''} ${error.message ?? ''}`.trim()) ?? [
      'Invalid unit catalog',
    ];
  }
  if (!Array.isArray(units)) {
    return ['Unit catalog must be an array'];
  }
  const ids = new Set(units.map((unit: { id: string }) => unit.id));
  if (ids.size !== units.length) {
    return ['Duplicate unit ids'];
  }
  return null;
}

export async function createUnitDataServer(options: UnitDataServerOptions): Promise<UnitDataServer> {
  const paths = resolvePaths(options);
  const validate = await loadValidator(options.repoRoot, paths.schemaPath);

  return {
    loadUnits() {
      return JSON.parse(readFileSync(paths.unitsPath, 'utf8')) as Unit[];
    },
    saveUnits(units) {
      const errors = validateUnits(validate, units);
      if (errors) {
        return { ok: false, errors };
      }

      writeFileSync(paths.unitsPath, `${JSON.stringify(units, null, 2)}\n`, 'utf8');
      execFileSync('node', [paths.compileUnitsScript], { stdio: 'pipe', cwd: options.repoRoot });
      execFileSync('node', [paths.compileIconsScript], { stdio: 'pipe', cwd: options.repoRoot });
      return { ok: true };
    },
  };
}
