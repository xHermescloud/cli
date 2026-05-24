import { apiFetch } from "../api.js";
import { amber, dim } from "../ui.js";

type MeResponse = {
  user: { id: string; xHandle: string | null; walletAddress: string | null };
  agent: { id: string; status: string; model: string } | null;
};

export const runWhoamiCommand = async (): Promise<void> => {
  const res = await apiFetch("/api/cli/me");
  if (!res.ok) {
    throw new Error(`whoami failed: ${res.status}`);
  }
  const me = (await res.json()) as MeResponse;
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
