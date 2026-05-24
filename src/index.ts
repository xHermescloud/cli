#!/usr/bin/env node
import { Command } from "commander";
import { runAuthCommand } from "./commands/auth.js";
import { runWhoamiCommand } from "./commands/whoami.js";
import { runLogoutCommand } from "./commands/logout.js";

const DEFAULT_BASE_URL = process.env.XHERMES_BASE_URL ?? "https://xhermes.com";

const program = new Command();
program.name("xhermes").version("0.0.1");

program
  .command("auth")
  .description("Authenticate this machine with xHermes.")
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

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
