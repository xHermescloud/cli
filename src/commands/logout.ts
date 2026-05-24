import { apiFetch } from "../api.js";
import { clearCreds } from "../config.js";

export const runLogoutCommand = async (): Promise<void> => {
  try { await apiFetch("/api/cli/logout", { method: "POST" }); } catch { /* ignore */ }
  clearCreds();
  console.log("logged out");
};
