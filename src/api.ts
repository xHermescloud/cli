import { loadCreds } from "./config.js";
import { CLI_VERSION, CLI_VERSION_HEADER } from "./version.js";

/// HTTP helpers for commands that require an authenticated session.
/// Commands that don't (the auth flow) use plain fetch directly via
/// `fetchWithVersion` to keep the version header consistent everywhere.

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated. Run `xhermes auth` first.");
  }
}

export class UpgradeRequiredError extends Error {
  constructor(public readonly installHint: string) {
    super(`This CLI is too old for the server.\n  → ${installHint}`);
  }
}

const requireCreds = () => {
  const c = loadCreds();
  if (!c) throw new NotAuthenticatedError();
  return c;
};

/// Bearer-authenticated fetch. Adds the version header and surfaces a
/// typed UpgradeRequiredError on HTTP 426 so commands can render a clear
/// install hint instead of a generic "fetch failed".
export const apiFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const { token, baseUrl } = requireCreds();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  headers.set(CLI_VERSION_HEADER, CLI_VERSION);
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  await throwIfUpgradeRequired(res);
  return res;
};

/// Unauth'd fetch helper for endpoints in the auth flow (start, poll).
/// Same version header + 426 handling so the user gets the upgrade prompt
/// before they get a confusing "authorization undefined" error.
export const fetchWithVersion = async (
  url: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers);
  headers.set(CLI_VERSION_HEADER, CLI_VERSION);
  const res = await fetch(url, { ...init, headers });
  await throwIfUpgradeRequired(res);
  return res;
};

const throwIfUpgradeRequired = async (res: Response): Promise<void> => {
  if (res.status !== 426) return;
  const body = (await res.clone().json().catch(() => ({}))) as { install?: string };
  throw new UpgradeRequiredError(body.install ?? "npm i -g @xhermes/cli@latest");
};
