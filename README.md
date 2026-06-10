# Greckon

Monorepo scaffold for a turn-based combat game with lobby matchmaking.

## Setup

```bash
pnpm install
pnpm codegen
pnpm build
```

## Start / stop

**Single entry point:** [`scripts/lib/dev-config.mjs`](scripts/lib/dev-config.mjs) defines players, ports, and commands. [`scripts/start-dev.mjs`](scripts/start-dev.mjs) orchestrates everything.

| Command | What it does |
|---------|----------------|
| `pnpm start` | Build once, start **lobby + web UI** at http://localhost:3000 (opens browser) |
| `pnpm restart` | **Stop**, rebuild, start headless (one lobby in `.greckon/lobby.log`) — reload the browser tab |
| `pnpm restart:fast` | Stop and start without rebuild |
| `pnpm restart:terminal` | Restart and open a new lobby terminal window (close old ones manually) |
| `pnpm start:headless` | Lobby detached; open http://localhost:3000 in your browser to play |
| `pnpm stop` | Stop lobby and any CLI clients |
| `pnpm start:lobby` | Lobby only (terminal window, or `--headless`) |
| `pnpm start:client alice` | Headless CLI client (optional; for automation) |

Play in the browser: open **http://localhost:3000**, enter your username, and click **Enter lobby**. Matchmaking starts when you connect to the lobby WebSocket; you are paired with a bot opponent.

Optional CLI client for scripts/tests: `GRECKON_PLAYERS=alice pnpm start:headless`. Bot name: `GRECKON_BOT_USERNAME=opponent`. Disable auto-open browser: `GRECKON_OPEN_BROWSER=0`.

Terminal windows run [`scripts/run-lobby.mjs`](scripts/run-lobby.mjs) and [`scripts/run-client.mjs`](scripts/run-client.mjs) with live output. Headless mode writes `.greckon/lobby.log`, `.greckon/client-alice.log`, etc.

**Ports (defaults):**

- HTTP + lobby WS: `http://localhost:3000` (`/lobby`, `/combat-registry`)
- Combat client WS: `ws://localhost:4001`

**Gameplay timing (temporary defaults in `@greckon/core`):**

- `maxRounds`: 10
- `turnWindowSeconds`: 2 (action selection deadline)
- `fightPlaybackSeconds`: 2
- `actionSelectionSeconds`: 2 (unit pick deadline)

**Client screen states** (logged as `[screen] ...`):

`loading` → `login` → `lobby` → `combat_unit_pick` → `combat_action_selection` → `combat_fight_playback` → `combat_round_end` → `combat_match_end` → `lobby`

Override via env: `GRECKON_HTTP_PORT`, `GRECKON_HOST`, `GRECKON_CLIENT_WS_PORT`, `GRECKON_API_URL`, `GRECKON_USERNAME`, `GRECKON_SKIP_BUILD=1`, `GRECKON_OPEN_BROWSER=0`.

**Typical dev loop after code changes:**

```bash
pnpm restart
# then hard-refresh the browser tab (Ctrl+Shift+R)
```

## Tests

```bash
pnpm test
```

Many tests still target unimplemented gameplay logic; the runtime stack above is a minimal prototype.
