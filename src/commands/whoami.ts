import { apiFetch } from "../api.js";
import { loadCreds, saveCreds } from "../config.js";
import { amber, dim } from "../ui.js";

type MeResponse = {
  user: { id: string; xHandle: string | null; walletAddress: string | null };
  agent: { id: string; status: string; model: string } | null;
  bridgeUrl?: string;
};

export const runWhoamiCommand = async (): Promise<void> => {
  const res = await apiFetch("/api/cli/me");
  if (!res.ok) {
    throw new Error(`whoami failed: ${res.status}`);
  }
  const me = (await res.json()) as MeResponse;

  // Opportunistically refresh creds.bridgeUrl so it tracks server-side changes
  // without forcing a re-auth. Skip when the server returns an empty string
  // (dev, no override) — we don't want to wipe a previously-stored value.
  const creds = loadCreds();
  if (creds && me.bridgeUrl && me.bridgeUrl !== creds.bridgeUrl) {
    saveCreds({ ...creds, bridgeUrl: me.bridgeUrl });
  }

  const ident = me.user.xHandle ? `@${me.user.xHandle}` : me.user.id;
  console.log(amber("user")  + "   " + ident);
  if (me.user.walletAddress) {
    console.log(amber("wallet") + " " + shortAddress(me.user.walletAddress));
  }
  if (me.agent) {
    console.log(amber("agent") + "  " + me.agent.id + " " + dim(`(${me.agent.status}, ${me.agent.model})`));
  } else {
    console.log(dim("no agent provisioned"));
  }
};

const shortAddress = (addr: string): string =>
  addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
