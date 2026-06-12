import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { createUnitDataServer } from '@greckon/services/units/server';

const pluginDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pluginDir, '../../..');

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function unitsApiPlugin(): Plugin {
  let unitDataPromise: ReturnType<typeof createUnitDataServer> | null = null;

  const getUnitData = () => {
    unitDataPromise ??= createUnitDataServer({ repoRoot });
    return unitDataPromise;
  };

  return {
    name: 'units-api',
    configureServer(server) {
      void getUnitData();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/units')) {
          next();
          return;
        }

        const host = req.headers.host ?? '';
        if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
          sendJson(res, 403, { ok: false, errors: ['API is localhost-only'] });
          return;
        }

        let unitData: Awaited<ReturnType<typeof createUnitDataServer>>;
        try {
          unitData = await getUnitData();
        } catch (error) {
          sendJson(res, 500, { ok: false, errors: [String(error)] });
          return;
        }

        if (req.method === 'GET') {
          try {
            sendJson(res, 200, unitData.loadUnits());
          } catch (error) {
            sendJson(res, 500, { ok: false, errors: [String(error)] });
          }
          return;
        }

        if (req.method === 'PUT') {
          try {
            const body = await readBody(req);
            const units = JSON.parse(body);
            const result = unitData.saveUnits(units);
            if (!result.ok) {
              sendJson(res, 400, result);
              return;
            }
            sendJson(res, 200, result);
          } catch (error) {
            sendJson(res, 500, { ok: false, errors: [String(error)] });
          }
          return;
        }

        sendJson(res, 405, { ok: false, errors: ['Method not allowed'] });
      });
    },
  };
}
