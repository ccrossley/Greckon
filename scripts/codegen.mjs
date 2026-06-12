import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { compileFromFile } from 'json-schema-to-typescript';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const generatedDir = join(root, 'packages/core/src/generated');

execFileSync('node', [join(root, 'scripts/compile-factions.mjs')], { stdio: 'inherit', cwd: root });
execFileSync('node', [join(root, 'scripts/compile-abilities.mjs')], { stdio: 'inherit', cwd: root });
execFileSync('node', [join(root, 'scripts/compile-units.mjs')], { stdio: 'inherit', cwd: root });
execFileSync('node', [join(root, 'scripts/compile-unit-icons.mjs')], {
  stdio: 'inherit',
  cwd: root,
});
execFileSync('node', [join(root, 'scripts/compile-paper-dolls.mjs')], {
  stdio: 'inherit',
  cwd: root,
});

await mkdir(generatedDir, { recursive: true });

execFileSync(
  'pnpm',
  [
    'exec',
    'openapi-typescript',
    join(root, 'schemas/openapi/greckon.yaml'),
    '-o',
    join(generatedDir, 'openapi.ts'),
  ],
  { stdio: 'inherit', cwd: root },
);

const wsSchemas = [
  { input: 'schemas/ws/lobby-client.json', output: 'ws-lobby-client.ts' },
  { input: 'schemas/ws/combat-client.json', output: 'ws-combat-client.ts' },
  {
    input: 'schemas/ws/lobby-combat-server.json',
    output: 'ws-lobby-combat-server.ts',
  },
];

for (const schema of wsSchemas) {
  const ts = await compileFromFile(join(root, schema.input), {
    bannerComment: '',
    additionalProperties: false,
  });
  await writeFile(join(generatedDir, schema.output), ts, 'utf8');
}

console.log('Codegen complete.');
