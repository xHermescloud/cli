import WebSocket from "ws";
import { loadCreds } from "../config.js";
import { NotAuthenticatedError } from "../api.js";
import { amber, dim, red } from "../ui.js";

/// Bridge stdin/stdout to the agent's Hermes terminal via the term-bridge
/// server. Puts the local TTY in raw mode, forwards keystrokes upstream, and
/// dumps the agent's ANSI output to stdout verbatim. Mirrors the dashboard's
/// xterm.js client.

const RESIZE_ESCAPE = (cols: number, rows: number): string =>
  `\x1B[RESIZE:${cols};${rows}]`;

/// Last-resort bridge URL when neither --bridge-url nor creds.bridgeUrl is set.
/// http://host:3000 → ws://host:3001 ; https:// → wss:// with the same +1 port.
/// Dev only — production CLIs always have a server-supplied bridgeUrl.
const defaultBridgeUrl = (baseUrl: string): string => {
  const u = new URL(baseUrl);
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const port = u.port ? String(Number(u.port) + 1) : "3001";
  return `${wsProto}//${u.hostname}:${port}/term`;
};

export type TermOptions = { bridgeUrl?: string };

export const runTermCommand = async (opts: TermOptions): Promise<void> => {
  const creds = loadCreds();
  if (!creds) throw new NotAuthenticatedError();

  // Precedence: --bridge-url flag > server-supplied (stored at auth time) > dev fallback.
  const bridge = opts.bridgeUrl ?? creds.bridgeUrl ?? defaultBridgeUrl(creds.baseUrl);
  const url = `${bridge}?token=${encodeURIComponent(creds.token)}`;

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(red("xhermes term requires a TTY") + "\n");
    process.exit(2);
  }

  process.stderr.write(dim(`connecting to ${bridge}…`) + "\n");

  const ws = new WebSocket(url);

  const onResize = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    ws.send(RESIZE_ESCAPE(cols, rows));
  };

  const cleanup = () => {
    // Restore the terminal state Hermes mutated on connect. Without this the
    // host shell receives raw mouse-tracking events (`<35;col;row M`), the
    // alternate-screen buffer remains active, or the cursor stays hidden.
    // Matches what tmux/vim emit on exit.
    process.stdout.write(
      "\x1B[?1000l" + // disable X11 mouse reporting
      "\x1B[?1002l" + // disable cell-motion mouse reporting
      "\x1B[?1003l" + // disable all-motion mouse reporting
      "\x1B[?1006l" + // disable SGR extended mouse
      "\x1B[?1015l" + // disable urxvt extended mouse
      "\x1B[?2004l" + // disable bracketed-paste
      "\x1B[?25h"   + // show cursor
      "\x1B[?1049l",  // leave alternate-screen buffer
    );
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      try { process.stdin.setRawMode(false); } catch { /* */ }
    }
    process.stdout.off("resize", onResize);
    process.stdin.pause();
  };

  ws.on("open", () => {
    process.stderr.write(amber("● connected") + dim(" — Ctrl+C to exit") + "\n\n");
    process.stdin.setRawMode?.(true);
    process.stdin.resume();

    // Ctrl+C watcher MUST be registered before the forwarder so it runs first.
    process.stdin.on("data", (chunk: Buffer) => {
      if (chunk.length === 1 && chunk[0] === 0x03) {
        try { ws.close(1000); } catch { /* */ }
      }
    });
    process.stdin.on("data", (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
    });

    process.stdout.on("resize", onResize);
    onResize();
  });

  ws.on("message", (data: WebSocket.RawData, isBinary: boolean) => {
    // /api/pty is a raw terminal byte stream both ways. Write verbatim.
    if (isBinary) process.stdout.write(data as Buffer);
    else process.stdout.write(data.toString());
  });

  ws.on("close", (code: number, reason: Buffer) => {
    cleanup();
    if (code === 1000 || code === 1005) {
      process.stderr.write("\n" + dim("● disconnected") + "\n");
      process.exit(0);
    }
    const hint = closeCodeHint(code, reason?.toString() || "");
    process.stderr.write("\n" + red(`● ${hint.headline}`) + "\n");
    if (hint.body) process.stderr.write(dim(hint.body) + "\n");
    process.exit(1);
  });

  ws.on("error", (err: Error) => {
    cleanup();
    process.stderr.write("\n" + red(`error: ${err.message}`) + "\n");
    process.exit(1);
  });
};

/// Map bridge-side close codes to human-readable copy. The bridge uses
/// 4401 (auth), 4409 (no active agent), 4502 (upstream unreachable) — see
/// apps/web/src/server/termBridge.ts. Unknown codes pass through verbatim
/// so we never hide diagnostics.
const closeCodeHint = (
  code: number,
  reason: string,
): { headline: string; body?: string } => {
  switch (code) {
    case 4401:
      return {
        headline: "authentication failed",
        body: "Your token is invalid or revoked. Run `xhermes logout` then `xhermes auth` again.",
      };
    case 4409:
      return {
        headline: "no active agent",
        body: "Provision one in the dashboard, then try again.",
      };
    case 4502:
      return {
        headline: "agent unreachable",
        body: "It may be waking from hibernation — try again in a moment.",
      };
    default:
      return { headline: `disconnected (${code}${reason ? ` ${reason}` : ""})` };
  }
};
