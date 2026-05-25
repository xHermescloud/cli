import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/// On-disk CLI credentials. Stored at $XHERMES_CONFIG_DIR/credentials.json or,
/// failing that, $XDG_CONFIG_HOME/xhermes/ or ~/.config/xhermes/. Mode 600.

export type Creds = {
  token: string;
  baseUrl: string;
  /** Server-supplied WS URL of the term-bridge. Optional for older creds files;
   *  when absent the CLI derives a dev fallback from baseUrl. */
  bridgeUrl?: string;
};

export const credentialsPath = (): string => {
  const override = process.env.XHERMES_CONFIG_DIR;
  if (override) return join(override, "credentials.json");
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdg, "xhermes", "credentials.json");
};

export const loadCreds = (): Creds | null => {
  const p = credentialsPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Creds;
};

export const saveCreds = (creds: Creds): void => {
  const p = credentialsPath();
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(creds, null, 2));
  try { chmodSync(p, 0o600); } catch { /* Windows lacks POSIX modes; tolerate. */ }
};

export const clearCreds = (): void => {
  const p = credentialsPath();
  if (existsSync(p)) rmSync(p, { force: true });
};
