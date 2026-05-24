import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCreds, saveCreds, clearCreds, credentialsPath } from "../src/config";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "xhcli-"));
  process.env.XHERMES_CONFIG_DIR = dir;
});

describe("CLI credentials", () => {
  it("returns null when the file does not exist", () => {
    expect(loadCreds()).toBeNull();
  });

  it("round-trips saved credentials", () => {
    saveCreds({ token: "xhm_test", baseUrl: "http://localhost:3000" });
    expect(loadCreds()).toEqual({ token: "xhm_test", baseUrl: "http://localhost:3000" });
  });

  it("clearCreds removes the file", () => {
    saveCreds({ token: "xhm_test", baseUrl: "http://localhost:3000" });
    clearCreds();
    expect(loadCreds()).toBeNull();
  });

  it("credentialsPath honors XHERMES_CONFIG_DIR", () => {
    expect(credentialsPath()).toBe(join(dir, "credentials.json"));
  });
});
