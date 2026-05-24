import { describe, expect, it, vi, beforeEach } from "vitest";
import { runDeviceCodeFlow } from "../src/commands/auth";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("runDeviceCodeFlow", () => {
  it("posts to /start, prints the user code, polls until approved, returns the token", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/api/cli/auth/start")) {
        return new Response(
          JSON.stringify({
            device_code: "DEVICE",
            user_code: "ABCD-2345",
            verification_uri: "https://example.test/cli/authorize",
            interval: 0,
            expires_in: 600,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/api/cli/auth/poll")) {
        const seen = calls.filter((c) => c.includes("/poll")).length;
        if (seen === 1) {
          return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ status: "approved", token: "xhm_test" }),
          { status: 200 },
        );
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const logs: string[] = [];
    const log = (s: string) => logs.push(s);

    const result = await runDeviceCodeFlow({
      baseUrl: "https://example.test",
      label: "test",
      log,
      openBrowser: () => undefined,
    });

    expect(result.token).toBe("xhm_test");
    expect(logs.some((l) => l.includes("ABCD-2345"))).toBe(true);
    expect(calls.filter((c) => c.includes("/poll")).length).toBeGreaterThanOrEqual(2);
  });
});
