#!/usr/bin/env node
import { Command } from "commander";
import { loadCreds } from "./config.js";
import { CLI_VERSION } from "./version.js";
import { runAuthCommand } from "./commands/auth.js";
import { runWhoamiCommand } from "./commands/whoami.js";
import { runLogoutCommand } from "./commands/logout.js";
import { runTermCommand } from "./commands/term.js";

const DEFAULT_BASE_URL = process.env.XHERMES_BASE_URL ?? "https://xhermes.cloud";

const program = new Command();
program.name("xhermes").version(CLI_VERSION);

/// Default action: authenticate if needed, then drop into the agent terminal.
/// This is the one-command happy path — `xhermes` is enough.
program
  .option("--base-url <url>", "Override the control-plane base URL.", DEFAULT_BASE_URL)
  .option("--bridge-url <url>", "Override the term-bridge WebSocket URL.")
  .action(async (opts: { baseUrl: string; bridgeUrl?: string }) => {
    if (!loadCreds()) await runAuthCommand({ baseUrl: opts.baseUrl });
    await runTermCommand({ bridgeUrl: opts.bridgeUrl });
  });

program
  .command("auth")
  .description("Authenticate this machine with xHermes (no terminal connect).")
  .option("--base-url <url>", "Override the control-plane base URL.", DEFAULT_BASE_URL)
  .action(async (opts: { baseUrl: string }) => runAuthCommand(opts));

program
  .command("whoami")
  .description("Show the signed-in user and agent.")
  .action(async () => runWhoamiCommand());

program
  .command("logout")
  .description("Revoke this machine's token and forget it locally.")
  .action(async () => runLogoutCommand());

program
  .command("term")
  .description("Open an interactive terminal session with your agent.")
  .option("--bridge-url <url>", "Override the term-bridge WebSocket URL.")
  .action(async (opts: { bridgeUrl?: string }) => runTermCommand(opts));

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
