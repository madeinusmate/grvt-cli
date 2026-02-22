import { Command } from "commander";
import { registerConfigCommands } from "./commands/config.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerAccountCommands } from "./commands/account.js";
import { registerMarketCommands } from "./commands/market.js";
import { registerTradeCommands } from "./commands/trade/index.js";
import { registerFundsCommands } from "./commands/funds/index.js";

const program = new Command();

program
  .name("grvt")
  .description("CLI tool to trade on GRVT markets")
  .version("0.1.0")
  .option("--output <format>", "output format: json|ndjson|table|raw", "table")
  .option("--pretty", "pretty-print JSON output")
  .option("--silent", "suppress logs, only data to stdout")
  .option("--no-color", "disable colored output")
  .option("--yes", "skip confirmation prompts")
  .option("--retries <n>", "number of retries on failure", "3")
  .option("--timeout-ms <n>", "request timeout in milliseconds", "10000");

registerConfigCommands(program);
registerAuthCommands(program);
registerAccountCommands(program);
registerMarketCommands(program);
registerTradeCommands(program);
registerFundsCommands(program);

program.parse();
