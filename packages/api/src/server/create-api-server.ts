import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ApiConfig, ApiServer } from '../index.js';
import { createAuthService, getPlayerIdFromToken } from '../auth.js';
import {
  createLobbyService,
  getBotFromMatch,
  getHumanFromMatch,
  getQueuePosition,
  finishMatch,
  matchmakeWithBot,
  setMatchCombatInfo,
} from '../lobby/index.js';
import {
  assignMatchToCombatServer,
  clearMatchAssignment,
  getCombatServer,
  registerCombatServer,
} from '../ws/combat-registry.js';
import { broadcastLobby, registerLobbyClient, sendLobbyToPlayer } from '../ws/lobby-socket.js';
import { spawnCombatServer } from '../spawn/combat-server-spawner.js';
import { spawnCombatBot } from '../bot/spawn-combat-bot.js';
import { tryServeWebApp, webAppAvailable } from './static-files.js';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function getBearer(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice(7);
}

export async function createApiServer(config: ApiConfig): Promise<ApiServer> {
  const host = process.env.GRECKON_HOST ?? 'localhost';
  const auth = createAuthService();
  const getLobbyWsUrl = () => `ws://${host}:${config.httpPort}${config.lobbyWsPath}`;
  const lobby = createLobbyService(getLobbyWsUrl);
  let spawnedServerId: string | undefined;
  let combatClientPort = Number(process.env.GRECKON_CLIENT_WS_PORT ?? 4001);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${host}:${config.httpPort}`);
    try {
      if (req.method === 'POST' && url.pathname === '/auth/login') {
        const body = JSON.parse(await readBody(req)) as { username?: string };
        if (!body.username) {
          sendJson(res, 400, { error: 'bad_request', message: 'username required' });
          return;
        }
        const session = await auth.login(body.username);
        sendJson(res, 200, session);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/auth/logout') {
        const token = getBearer(req);
        if (!token) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        await auth.logout(token);
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/auth/me') {
        const token = getBearer(req);
        const session = token ? await auth.getSession(token) : null;
        if (!session) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        sendJson(res, 200, session);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/lobby/join') {
        const token = getBearer(req);
        const playerId = getPlayerIdFromToken(token);
        if (!playerId || !token) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        const result = await lobby.join(playerId, token);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && url.pathname === '/lobby/leave') {
        const token = getBearer(req);
        const playerId = getPlayerIdFromToken(token);
        if (!playerId) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        await lobby.leave(playerId);
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/lobby/status') {
        const token = getBearer(req);
        const playerId = getPlayerIdFromToken(token);
        if (!playerId) {
          sendJson(res, 401, { error: 'unauthorized' });
          return;
        }
        sendJson(res, 200, await lobby.getStatus(playerId));
        return;
      }

      if (req.method === 'GET' && tryServeWebApp(res, url.pathname)) {
        return;
      }

      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      sendJson(res, 500, {
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const lobbyWs = new WebSocketServer({ noServer: true });
  const registryWs = new WebSocketServer({ noServer: true });

  function tryStartMatchForConnectedHuman(): void {
    if (!spawnedServerId) {
      return;
    }
    const matchId = matchmakeWithBot();
    if (!matchId) {
      return;
    }
    const server = getCombatServer(spawnedServerId);
    if (!server) {
      return;
    }
    const combatWsUrl = `ws://${server.host}:${server.clientWsPort}`;
    setMatchCombatInfo(matchId, combatWsUrl, spawnedServerId);
    assignMatchToCombatServer(matchId, spawnedServerId);

    const human = getHumanFromMatch(matchId);
    const bot = getBotFromMatch(matchId);
    if (human) {
      sendLobbyToPlayer(human.playerId, {
        type: 'MatchFound',
        matchId,
        combatWsUrl,
        opponent: {
          playerId: bot!.playerId,
          username: bot!.username,
        },
      });
    }
    if (bot) {
      spawnCombatBot(combatWsUrl, bot.token);
    }
    console.log(`[lobby] match ${matchId} started for ${human?.username} vs ${bot?.username}`);
  }

  lobbyWs.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', `http://${host}:${config.httpPort}`);
    const token = url.searchParams.get('token');
    const playerId = getPlayerIdFromToken(token ?? undefined);
    if (!playerId) {
      socket.close();
      return;
    }

    registerLobbyClient(socket, playerId);
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(String(data)) as { type?: string };
        if (message.type === 'Ping') {
          socket.send(JSON.stringify({ type: 'Pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    sendLobbyToPlayer(playerId, {
      type: 'QueueUpdate',
      queuePosition: getQueuePosition(playerId),
    });
    tryStartMatchForConnectedHuman();
  });

  registryWs.on('connection', (socket) => {
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(String(data)) as {
          type?: string;
          serverId?: string;
          host?: string;
          clientWsPort?: number;
          capacity?: number;
          matchId?: string;
          winnerPlayerId?: string;
        };
        if (
          message.type === 'RegisterServer' &&
          message.serverId &&
          message.host &&
          message.clientWsPort &&
          message.capacity
        ) {
          registerCombatServer(
            message.serverId,
            message.host,
            message.clientWsPort,
            message.capacity,
            socket,
          );
          if (!spawnedServerId) {
            spawnedServerId = message.serverId;
          }
        }
        if (message.type === 'MatchComplete' && message.matchId) {
          console.log(`[lobby] match complete ${message.matchId} winner=${message.winnerPlayerId}`);
          finishMatch(message.matchId);
          clearMatchAssignment(message.matchId);
        }
      } catch {
        // ignore malformed messages
      }
    });
  });

  httpServer.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '/', `http://${host}:${config.httpPort}`).pathname;
    if (pathname === config.lobbyWsPath) {
      lobbyWs.handleUpgrade(req, socket, head, (ws) => {
        lobbyWs.emit('connection', ws, req);
      });
      return;
    }
    if (pathname === config.combatRegistryWsPath) {
      registryWs.handleUpgrade(req, socket, head, (ws) => {
        registryWs.emit('connection', ws);
      });
      return;
    }
    socket.destroy();
  });

  return {
    async start() {
      await new Promise<void>((resolve) => {
        httpServer.listen(config.httpPort, () => resolve());
      });
      const registryUrl = `ws://${host}:${config.httpPort}${config.combatRegistryWsPath}`;
      const handle = spawnCombatServer({
        lobbyWsUrl: registryUrl,
        clientWsPort: combatClientPort,
      });
      spawnedServerId = handle.serverId;
      console.log(`[lobby] HTTP http://${host}:${config.httpPort}`);
      if (webAppAvailable()) {
        console.log(`[lobby] web client http://${host}:${config.httpPort}/`);
      }
      console.log(`[lobby] lobby WS ${getLobbyWsUrl()}`);
      console.log(`[lobby] combat registry ${registryUrl}`);
      console.log(`[lobby] spawned combat server pid=${handle.pid} id=${handle.serverId}`);
    },
    async stop() {
      broadcastLobby({ type: 'ServerShutdown', reason: 'shutdown', reconnectAfterMs: 3000 });
      const { killAllCombatServers } = await import('../spawn/combat-server-spawner.js');
      await killAllCombatServers();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      lobbyWs.close();
      registryWs.close();
    },
  };
}
