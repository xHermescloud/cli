import { describe, expect, it, vi, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { saveCreds } from "../src/config";
import { apiFetch, fetchWithVersion, UpgradeRequiredError } from "../src/api";
import { CLI_VERSION, CLI_VERSION_HEADER } from "../src/version";

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "xhcli-api-"));
  process.env.XHERMES_CONFIG_DIR = dir;
  saveCreds({ token: "xhm_test", baseUrl: "https://example.test" });
});

describe("apiFetch", () => {
  it("attaches the bearer + version header", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      expect(h.get("authorization")).toBe("Bearer xhm_test");
      expect(h.get(CLI_VERSION_HEADER.toLowerCase())).toBe(CLI_VERSION);
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/cli/me");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws UpgradeRequiredError on 426 with the install hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ install: "npm i -g xhermes@2" }), {
          status: 426,
        }),
      ),
    );
    await expect(apiFetch("/api/cli/me")).rejects.toBeInstanceOf(UpgradeRequiredError);
    try {
      await apiFetch("/api/cli/me");
    } catch (e) {
      expect((e as UpgradeRequiredError).installHint).toBe("npm i -g xhermes@2");
    }
  });
});

describe("fetchWithVersion", () => {
  it("sets the version header on unauth'd requests too", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      expect(h.get(CLI_VERSION_HEADER.toLowerCase())).toBe(CLI_VERSION);
      expect(h.get("authorization")).toBeNull();
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchWithVersion("https://example.test/api/cli/auth/start", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
