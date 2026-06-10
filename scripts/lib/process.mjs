import { existsSync, mkdirSync, openSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const rootDir = join(__dirname, '../..');
export const runtimeDir = join(rootDir, '.greckon');
export const pidFile = (name) => join(runtimeDir, `${name}.pid`);
export const logFile = (name) => join(runtimeDir, `${name}.log`);

export async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

export async function readPid(name) {
  const path = pidFile(name);
  if (!existsSync(path)) {
    return null;
  }
  const value = Number((await readFile(path, 'utf8')).trim());
  return Number.isFinite(value) ? value : null;
}

export async function writePid(name, pid) {
  await ensureRuntimeDir();
  await writeFile(pidFile(name), `${pid}\n`, 'utf8');
}

export async function clearPid(name) {
  const path = pidFile(name);
  if (existsSync(path)) {
    await unlink(path);
  }
}

export function isRunning(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function stopProcess(name, waitMs = 4000) {
  const pid = await readPid(name);
  if (!pid) {
    console.log(`[stop] ${name} is not running (no pid file)`);
    return false;
  }
  if (!isRunning(pid)) {
    console.log(`[stop] ${name} pid ${pid} is not running, cleaning up pid file`);
    await clearPid(name);
    return false;
  }
  process.kill(pid, 'SIGTERM');
  console.log(`[stop] sent SIGTERM to ${name} (pid ${pid})`);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && isRunning(pid)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (isRunning(pid)) {
    process.kill(pid, 'SIGKILL');
    console.log(`[stop] sent SIGKILL to ${name} (pid ${pid})`);
  }
  await clearPid(name);
  return true;
}

export function isPortInUse(port) {
  try {
    execFileSync('fuser', [`${port}/tcp`], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function waitForPortFree(port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPortInUse(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  console.log(`[stop] warning: port ${port} still in use after ${timeoutMs}ms`);
  return false;
}

export async function killPort(port) {
  if (!isPortInUse(port)) {
    return false;
  }
  try {
    execFileSync('fuser', [`${port}/tcp`, '-k'], { stdio: 'pipe' });
    console.log(`[stop] freed port ${port}`);
    return true;
  } catch {
    return false;
  }
}

export function spawnDetached(name, args, env = {}) {
  const logPath = logFile(name);
  if (!existsSync(runtimeDir)) {
    mkdirSync(runtimeDir, { recursive: true });
  }
  const out = openSync(logPath, 'a');
  return spawn(process.execPath, args, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', out, out],
  });
}

export async function buildPackages() {
  execFileSync('pnpm', ['build'], { cwd: rootDir, stdio: 'inherit' });
}
