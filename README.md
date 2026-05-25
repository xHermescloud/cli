# @xhermes/cli

> Talk to your [Hermes agent](https://hermes-agent.nousresearch.com) from your own terminal.

The **xHermes CLI** is a thin terminal client for the [xHermes](https://xhermes.com) platform.  Authenticate with a device-code flow, then `xhermes term` drops you straight into your agent's pty — the same Hermes you provision in the browser, in iTerm/wezterm/Ghostty.

## Install

```sh
npm install -g @xhermes/cli
```

Requires Node ≥ 20. No native dependencies; works on macOS, Linux, and Windows.

You can also run it with no install:

```sh
npx @xhermes/cli
```

## Use

The one-shot happy path:

```sh
xhermes
```

Authenticates this machine if needed (opens a browser to xhermes.com to approve a short code), then connects you to your agent's terminal.  `Ctrl+C` exits.

### Subcommands

| Command | What it does |
|---|---|
| `xhermes` | Auth if needed, then connect (same as `xhermes term`). |
| `xhermes auth` | Just run the device-code flow.  Useful for first setup or re-auth after revoke. |
| `xhermes whoami` | Show your signed-in user and agent. |
| `xhermes term` | Open the agent terminal session. |
| `xhermes logout` | Revoke this machine's token on the server and forget it locally. |

### Flags

- `--base-url <url>` — point at a non-default control plane (default: `https://xhermes.com`).
- `--bridge-url <url>` — override the term-bridge WebSocket URL (the CLI normally fetches this from the server during auth).

You can also set `XHERMES_BASE_URL` or `XHERMES_CONFIG_DIR` in the environment.

## Where things live

| Path | What |
|---|---|
| `~/.config/xhermes/credentials.json` | Your bearer token, base URL, and bridge URL.  Mode 0600 on POSIX.  Override the directory with `XHERMES_CONFIG_DIR`. |

The credentials file contains a long-lived bearer token.  Treat it like an SSH key.

## How auth works

`xhermes auth` is a [device-code flow](https://datatracker.ietf.org/doc/html/rfc8628):

1. CLI asks the server for a `(device_code, user_code)` pair.
2. CLI shows the `user_code` and opens your browser to `<base-url>/cli/authorize?code=…`.
3. You confirm in the browser (signed-in xHermes session required).
4. CLI polls until the server confirms, then stores an opaque bearer token locally.

The plaintext token is delivered to the CLI **exactly once**.  The server stores only an HMAC.  Revoke any time from your xHermes dashboard or via `xhermes logout`.

## How `term` works

The CLI opens a WebSocket to the **term-bridge** service, authenticated via the bearer token.  The bridge resolves the token, looks up your agent, and pipes raw terminal bytes between you and the agent's pty.  See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full data path.

## Privacy & trust model

The term-bridge sees the **entire raw terminal stream** between you and your agent — every keystroke you type, every byte the agent prints.  This is operationally necessary (it's the same protocol the browser dashboard uses), and the bridge is operated by xHermes.

See [SECURITY.md](./SECURITY.md) for the threat model and what is and isn't logged.

## License

MIT — see [LICENSE](./LICENSE).
