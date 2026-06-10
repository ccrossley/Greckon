import { spawn } from 'node:child_process';
import {
  buildPackages,
  isRunning,
  killPort,
  readPid,
  rootDir,
  runtimeDir,
  spawnDetached,
  writePid,
} from './process.mjs';
import {
  clientEnv,
  clientEntryPath,
  clientPidName,
  devConfig,
  lobbyEnv,
  lobbyEntryPath,
  runClientShellCommand,
  runLobbyShellCommand,
  webClientUrl,
} from './dev-config.mjs';
import { openTerminalWindow } from './terminal.mjs';

export async function ensureBuilt() {
  await buildPackages();
}

export async function startLobbyDetached() {
  const name = 'lobby';
  const existing = await readPid(name);
  if (existing && isRunning(existing)) {
    console.log(`[greckon] lobby already running (pid ${existing})`);
    return existing;
  }

  const child = spawnDetached(name, [lobbyEntryPath()], lobbyEnv());
  child.unref();
  await writePid(name, child.pid);
  console.log(`[greckon] lobby started pid ${child.pid} log ${runtimeDir}/lobby.log`);
  return child.pid;
}

export async function startClientDetached(username) {
  const name = clientPidName(username);
  const existing = await readPid(name);
  if (existing && isRunning(existing)) {
    console.log(`[greckon] client ${username} already running (pid ${existing})`);
    return existing;
  }

  const child = spawnDetached(name, [clientEntryPath(), username], clientEnv(username));
  child.unref();
  await writePid(name, child.pid);
  console.log(`[greckon] client ${username} started pid ${child.pid} log ${runtimeDir}/${name}.log`);
  return child.pid;
}

export async function startLobbyInTerminal() {
  const launcher = openTerminalWindow('Greckon Lobby', runLobbyShellCommand());
  if (!launcher) {
    return startLobbyDetached();
  }
  console.log(`[greckon] lobby terminal opened via ${launcher}`);
  return null;
}

export async function startClientInTerminal(username) {
  const title = `Greckon Client (${username})`;
  const launcher = openTerminalWindow(title, runClientShellCommand(username));
  if (!launcher) {
    return startClientDetached(username);
  }
  console.log(`[greckon] client ${username} terminal opened via ${launcher}`);
  return null;
}

export async function startDev({
  headless = false,
  build = true,
  openBrowser = devConfig.openBrowser,
  skipPortKill = false,
} = {}) {
  if (build) {
    await ensureBuilt();
  } else {
    console.log('[greckon] skipping build (GRECKON_SKIP_BUILD=1 or --no-build)');
  }

  if (!skipPortKill) {
    await killPort(Number(devConfig.env.GRECKON_HTTP_PORT));
    await killPort(Number(devConfig.env.GRECKON_CLIENT_WS_PORT));
  }

  console.log('[greckon] starting dev stack...');
  if (devConfig.players.length > 0) {
    console.log(`[greckon] CLI players: ${devConfig.players.join(', ')}`);
  } else {
    console.log(`[greckon] play in browser: ${webClientUrl()}`);
  }

  if (headless) {
    await startLobbyDetached();
    await wait(devConfig.waitForLobbyMs);
    for (const player of devConfig.players) {
      await startClientDetached(player);
    }
    if (devConfig.players.length === 0) {
      console.log(`[greckon] open ${webClientUrl()} to play`);
    }
    console.log('[greckon] headless stack running (logs in .greckon/)');
    return;
  }

  await startLobbyInTerminal();
  await wait(devConfig.waitForLobbyMs);
  for (const player of devConfig.players) {
    await startClientInTerminal(player);
  }
  if (devConfig.players.length === 0 && openBrowser) {
    openBrowserWindow(webClientUrl());
  }
  console.log('[greckon] dev stack launched');
  console.log(`[greckon] web client: ${webClientUrl()}`);
  console.log('[greckon] stop with: pnpm stop');
  console.log('[greckon] restart with: pnpm restart');
}

function openBrowserWindow(url) {
  if (!devConfig.openBrowser) {
    return;
  }
  const platform = process.platform;
  const command =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
