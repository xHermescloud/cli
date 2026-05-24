import { loadCreds } from "./config.js";

/// HTTP helpers for commands that require an authenticated session.
/// Commands that don't (the auth flow) use plain fetch directly.

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated. Run `xhermes auth` first.");
  }
}

const requireCreds = () => {
  const c = loadCreds();
  if (!c) throw new NotAuthenticatedError();
  return c;
};

export const apiFetch = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const { token, baseUrl } = requireCreds();
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
};
