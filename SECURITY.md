# Security model

What this CLI trusts, what it doesn't, and how to report issues.

## Reporting issues

For anything that smells like a vulnerability, please email **security@xhermes.cloud** rather than opening a public issue.  We'll acknowledge within two business days.

## Threat model

### What this CLI is

A thin terminal client that authenticates you to xHermes and pipes raw bytes between your local terminal and your agent's pty over a TLS WebSocket.

### What this CLI is not

- A general-purpose remote shell.  The pty on the other end is the **Hermes agent's** terminal, not a shell on the Hetzner box.
- A multi-user tool.  One install, one bearer token, one user.

### What we trust

| | Trust level |
|---|---|
| `npmjs.com` (registry) | Implicit — you `npm install`'d us from there.  See [Verifying the install](#verifying-the-install) below. |
| xHermes control plane (`xhermes.cloud`) | Holds your token's HMAC.  Issues, validates, and revokes. |
| xHermes term-bridge (`wss://term.<…>`) | Sees the **entire raw terminal stream** between you and your agent.  This is operationally necessary — it's the same protocol the browser dashboard uses. |
| Your local machine | The file `~/.config/xhermes/credentials.json` is mode 0600 and contains a long-lived bearer token.  Anyone with read access to your home directory can use your agent. |

### What we don't trust

- Untrusted local processes.  We chmod 0600, but we don't sandbox anything.  If your machine is compromised, the token is too — `xhermes logout` from a clean machine and re-auth.
- Network operators.  All control-plane traffic is HTTPS; the bridge is WSS.  We do not validate certs beyond Node's defaults — same posture as `curl`.

## Token lifecycle

- **Issuance.**  The plaintext token is generated server-side, returned to the CLI **exactly once** via the device-code poll endpoint, then nulled out of the auth-request row.  The server stores only an HMAC-SHA256 keyed by a server-side pepper.
- **Storage on disk.**  `~/.config/xhermes/credentials.json`, mode 0600.  We do not use the system keychain.  If you want OS-keychain storage, file an issue — happy to add it.
- **Use.**  Sent as `Authorization: Bearer <token>` to xhermes.cloud APIs and as a `?token=…` query string to the term-bridge WebSocket (HTTP headers aren't portable on WS upgrade requests).
- **Revocation.**
  - `xhermes logout` — revokes server-side and clears the local file.
  - Dashboard → CLI access panel — revoke individual tokens by label.
  - Server-side pepper rotation invalidates **every** issued token in one shot.  This is a feature, not a bug; documented operational procedure for emergencies.
- **Expiry.**  Tokens currently do not expire (parity with industry-standard PATs like GitHub).  Optional `expires_at` is on the roadmap.

## What is logged

The term-bridge logs **metadata only** by default: connection open/close, agent id, channel id, source IP, bytes in/out, duration, close code.  **The terminal byte stream itself is never persisted by the bridge.**  In-transit, it crosses the wire as plain WSS frames between you, xhermes, and your agent — same trust profile as SSH-over-the-public-internet.

Conversation content capture (for "weekly receipts" features) is an explicit opt-in toggle on the roadmap.  Until then, what you type and what your agent says stays between you and the agent process.

## Verifying the install

Tagged releases are built by GitHub Actions in this repo and published to npm with [provenance](https://docs.npmjs.com/generating-provenance-statements).  You can verify the tarball you got from npm was built from a specific commit in this repo:

```sh
npm audit signatures
```

The provenance statement (Sigstore-signed, public transparency log) names the GitHub Actions run that built it.  Any divergence between the published tarball and what the workflow actually built is detectable.

## Out of scope

- Supply-chain attacks via our transitive dependencies (`commander`, `ws`).  We pin versions in `package-lock.json`; please monitor `npm audit` yourself.
- Vulnerabilities in the Hermes agent itself.  Those belong to Nous Research.
- Vulnerabilities in your operating system, terminal emulator, or Node.js runtime.

## Operational guarantees

We do not guarantee:

- Backwards compatibility of pre-1.0 releases.  Pre-1.0 we may break the protocol; the server's `MIN_CLI_VERSION` gate is how we prevent silent failures (you'll get a clear "upgrade required" message, not a hang).
- Uptime of the term-bridge.  It's a regular service, behind a regular load balancer, with regular outages.
- That every keystroke reaches the agent if the network is hostile.  WebSockets are TCP — same delivery semantics as SSH.

We do guarantee:

- That we will never display, share, or sell the contents of your terminal sessions.
- That `xhermes logout` actually invalidates your token server-side, not just locally.
- That the published npm tarball matches what's tagged in this repo, verifiable via npm provenance.
