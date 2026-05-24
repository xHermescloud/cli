#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();
program
  .name("xhermes")
  .description("Talk to your Hermes agent from the terminal.")
  .version("0.0.1");

// Subcommands are wired in later tasks.

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
