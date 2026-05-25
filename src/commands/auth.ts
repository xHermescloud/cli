import { hostname } from "node:os";
import { spawn } from "node:child_process";
import { saveCreds } from "../config.js";
import { fetchWithVersion } from "../api.js";
import { amber, banner, dim } from "../ui.js";

export type DeviceCodeFlowDeps = {
  baseUrl: string;
  label: string;
  log: (s: string) => void;
  openBrowser: (url: string) => void;
};

export type DeviceCodeFlowResult = {
  token: string;
  baseUrl: string;
  /** Bridge WS URL supplied by the server; absent if the server has no
   *  CLI_BRIDGE_URL configured (dev — the CLI then derives a fallback). */
  bridgeUrl?: string;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/// Run the device-code flow. Exported separately from `runAuthCommand` so it
/// can be unit-tested with a mocked fetch and no real browser.
export const runDeviceCodeFlow = async (
  deps: DeviceCodeFlowDeps,
): Promise<DeviceCodeFlowResult> => {
  const startRes = await fetchWithVersion(`${deps.baseUrl}/api/cli/auth/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ label: deps.label }),
  });
  if (!startRes.ok) throw new Error(`auth/start failed: ${startRes.status}`);
  const start = (await startRes.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    interval: number;
    bridge_url?: string;
  };

  deps.log("");
  deps.log(amber(`code: ${start.user_code}`));
  deps.log(dim(`open: ${start.verification_uri}?code=${start.user_code}`));
  deps.log("");
  deps.openBrowser(`${start.verification_uri}?code=${start.user_code}`);

  for (;;) {
    await sleep(start.interval * 1000);
    const r = await fetchWithVersion(`${deps.baseUrl}/api/cli/auth/poll`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode: start.device_code }),
    });
    // Server may rate-limit us. Honour Retry-After and try again.
    if (r.status === 429) {
      const retry = Number(r.headers.get("retry-after") ?? start.interval);
      await sleep(Math.max(retry, 1) * 1000);
      continue;
    }
    const j = (await r.json()) as { status: string; token?: string };
    if (j.status === "pending") continue;
    if (j.status === "approved" && j.token) {
      return {
        token: j.token,
        baseUrl: deps.baseUrl,
        bridgeUrl: start.bridge_url || undefined,
      };
    }
    throw new Error(`authorization ${j.status}`);
  }
};

const openInBrowser = (url: string): void => {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32"  ? "start" :
    "xdg-open";
  spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
};

export const runAuthCommand = async (opts: { baseUrl: string }): Promise<void> => {
  console.log(banner());
  const result = await runDeviceCodeFlow({
    baseUrl: opts.baseUrl,
    label: hostname(),
    log: (s) => console.log(s),
    openBrowser: openInBrowser,
  });
  saveCreds(result);
  console.log(amber("✓ authenticated"));
};
