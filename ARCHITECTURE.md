# Architecture

End-to-end of what happens when you run `xhermes`.

## Components

```
┌─────────────────┐          ┌────────────────┐          ┌──────────────────┐
│  @xhermes/cli   │          │  xhermes.cloud   │          │  agent fleet     │
│  (your machine) │          │  (control      │          │  (Hetzner box)   │
│                 │          │   plane)       │          │                  │
│  - device-code  │  HTTPS   │  - auth API    │  Postgres│  - term-bridge   │
│    auth         │ ───────► │  - dashboard   │ ◄──────  │  - Hermes        │
│  - bearer token │          │  - rate limit  │          │    containers    │
│  - raw pty I/O  │   WSS    │                │   WS     │  - Traefik       │
│                 │ ──────── │ ────────────── │ ───────► │                  │
└─────────────────┘          └────────────────┘          └──────────────────┘
```

Three independent layers, three independent failure modes.

## The data path of `xhermes term`

1. **CLI** loads `~/.config/xhermes/credentials.json` → `{ token, baseUrl, bridgeUrl }`.
2. **CLI** opens `wss://<bridgeUrl>/term?token=<bearer>`.
3. **term-bridge** receives the upgrade.  Reads the bearer from the query string and looks it up by HMAC in the `cli_tokens` table (HMAC keyed by a server-side pepper).  Rejects with close code `4401` if missing/revoked.
4. **term-bridge** looks up the user's agent.  Rejects with `4409` if there's no active agent.
5. **term-bridge** scrapes the per-container session token from the Hermes dashboard HTML at `http://<agent-container>:9119/`.  The token is inlined as `window.__HERMES_SESSION_TOKEN__`.
6. **term-bridge** generates a fresh channel UUID and opens `ws://<agent-container>:9119/api/pty?token=<session>&channel=<uuid>`.
7. **term-bridge** pipes bytes bidirectionally between the CLI's WebSocket and the agent's pty.  Closing either side closes the other.
8. **CLI** puts stdin into raw mode and copies stdin↔WebSocket as-is.  Terminal resize is forwarded as the synthetic ANSI escape `\x1B[RESIZE:<cols>;<rows>]`, matching what the in-browser xterm.js client emits.
9. On exit, **CLI** writes mode-restore escapes (mouse-tracking off, alt-screen off, cursor on) so the host shell isn't left in a weird state.

The CLI never sees the Hermes session token, the agent's container ID, or the Postgres connection.  Everything privileged stays server-side.

## The device-code flow

```
CLI                            xhermes.cloud (web)            user's browser
 │                                   │                            │
 │  POST /api/cli/auth/start         │                            │
 │  { label: "macbook-pro" }         │                            │
 │ ─────────────────────────────────►│                            │
 │  { device_code, user_code,        │                            │
 │    verification_uri,              │                            │
 │    bridge_url, interval, ... }    │                            │
 │ ◄─────────────────────────────────│                            │
 │                                   │                            │
 │  prints user_code, opens browser ──────────────────────────────►
 │                                   │                            │
 │                                   │ (user signs in if needed)  │
 │                                   │ POST /api/cli/auth/approve │
 │                                   │ { userCode }               │
 │                                   │ ◄──────────────────────────│
 │                                   │ (mints CliToken row)       │
 │                                   │                            │
 │  POST /api/cli/auth/poll          │                            │
 │  { device_code }                  │                            │
 │ ─────────────────────────────────►│                            │
 │  { status: "pending" }            │                            │
 │ ◄─────────────────────────────────│                            │
 │  (sleep `interval` seconds, repeat)                            │
 │                                   │                            │
 │  POST /api/cli/auth/poll          │                            │
 │ ─────────────────────────────────►│                            │
 │  { status: "approved",            │                            │
 │    token: "xhm_..." }   ◄── one shot, server nulls plaintext   │
 │ ◄─────────────────────────────────│                            │
 │                                   │                            │
 │  saves credentials.json           │                            │
```

The plaintext token is stored on the auth-request row only between approval and the first successful poll.  Replay after that returns `{status: "consumed"}`.

## Version handshake

Every CLI HTTP request carries `X-XHermes-CLI-Version`.  A Next middleware on `/api/cli/*` compares against `MIN_CLI_VERSION` on the server.  Below the floor → `426 Upgrade Required` with an install hint.  The CLI surfaces this as a typed `UpgradeRequiredError` with a clean message — not a stack trace.

WebSocket connections to the bridge don't carry HTTP headers, so version gating is HTTP-only.  Bumping `MIN_CLI_VERSION` for a protocol break also requires shipping a new client that knows the new protocol.

## Rate limits

- `POST /api/cli/auth/start` — 10/min per source IP.
- `POST /api/cli/auth/poll` — 1 per 1500ms per `device_code` (a tick under the 2-second `interval` we return so clock skew slides in).

Implemented as a Redis fixed-window counter via a single Lua call so INCR + PEXPIRE are atomic.  Both endpoints return `429` with a `Retry-After` header; the CLI honors it transparently.

## Dependencies

The CLI itself: `commander`, `ws`.  Nothing else.  No telemetry, no analytics, no auto-update.  See the `dependencies` block in `package.json` for the authoritative list.
