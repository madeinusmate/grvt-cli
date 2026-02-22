import { Command } from "commander";
import { createInterface } from "node:readline";
import { loadConfig, saveConfig } from "../core/config/store.js";
import { login, verifySession } from "../core/auth/session.js";
import { getGlobalOpts } from "../core/command-helpers.js";
import { handleCommandError } from "../core/output/errors.js";
import { disableColors, c } from "../core/output/colors.js";
import type { GrvtEnvironment } from "../core/client/endpoints.js";

const BANNER = `
 ██████╗ ██████╗ ██╗   ██╗████████╗    ██████╗██╗     ██╗
██╔════╝ ██╔══██╗██║   ██║╚══██╔══╝   ██╔════╝██║     ██║
██║  ███╗██████╔╝██║   ██║   ██║█████╗██║     ██║     ██║
██║   ██║██╔══██╗╚██╗ ██╔╝   ██║╚════╝██║     ██║     ██║
╚██████╔╝██║  ██║ ╚████╔╝    ██║      ╚██████╗███████╗██║
 ╚═════╝ ╚═╝  ╚═╝  ╚═══╝     ╚═╝       ╚═════╝╚══════╝╚═╝
                                                         
`;


const DISCLAIMER = [
  "WARNING — READ BEFORE CONTINUING.",
  "",
  "This is a community hobby project. It is NOT officially",
  "supported, endorsed, audited, or maintained by the GRVT",
  "team. No security audit or formal review has been performed.",
  "",
  "THIS SOFTWARE IS PROVIDED AS-IS WITH NO WARRANTY OF ANY",
  "KIND. THE CODE HAS NOT BEEN AUDITED FOR SECURITY",
  "VULNERABILITIES. BY USING THIS TOOL YOU ACKNOWLEDGE AND",
  "ACCEPT THE RISK OF TOTAL LOSS OF FUNDS.",
  "",
  "You are solely responsible for any financial losses,",
  "leaked credentials, or unintended trades that may result",
  "from using this software. Do NOT use this tool with funds",
  "you cannot afford to lose.",
  "",
  "This tool stores your API key and private key in plaintext",
  "on disk (with 0600 file permissions). Never share your",
  "private key. Never run this on shared or untrusted machines.",
  "",
  "Recommended baseline:",
  "- Only use testnet until you fully understand the CLI.",
  "- Review the source code before trusting it with real funds.",
  "- Keep your private key out of shell history (use `grvt setup`).",
  "- Rotate API keys regularly.",
  "- Never run with more funds than you can afford to lose.",
];

const ask = (rl: ReturnType<typeof createInterface>, question: string): Promise<string> =>
  new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });

const askWithDefault = async (rl: ReturnType<typeof createInterface>, question: string, defaultValue: string): Promise<string> => {
  const answer = await ask(rl, `${question} ${c().dim(`(${defaultValue})`)} `);
  return answer || defaultValue;
};

const VALID_ENVS = ["dev", "staging", "testnet", "prod"] as const;

export const registerSetupCommand = (program: Command) => {
  program
    .command("setup")
    .description("Interactive setup wizard to configure the CLI")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      if (globalOpts["color"] === false) disableColors();

      const rl = createInterface({ input: process.stdin, output: process.stderr });

      try {
        const config = loadConfig();

        // ASCII banner
        process.stderr.write(c().bold.green(BANNER));
        process.stderr.write("\n");

        // Disclaimer box
        const maxLen = Math.max(...DISCLAIMER.map((l) => l.length));
        const border = "─".repeat(maxLen + 2);
        process.stderr.write(c().green(`  ┌${border}┐\n`));
        for (const line of DISCLAIMER) {
          process.stderr.write(c().green(`  │ ${line.padEnd(maxLen)} │\n`));
        }
        process.stderr.write(c().green(`  └${border}┘\n`));
        process.stderr.write("\n");

        const accept = await ask(rl, c().bold.green("  I understand the risks. Continue? [y/N] "));
        if (accept.toLowerCase() !== "y") {
          process.stderr.write(c().dim("\n  Setup cancelled.\n\n"));
          rl.close();
          return;
        }

        process.stderr.write("\n");
        process.stderr.write(c().dim("  ─────────────────────────────────────\n"));
        process.stderr.write(c().bold("  GRVT CLI Setup\n"));
        process.stderr.write(c().dim("  This wizard will walk you through\n"));
        process.stderr.write(c().dim("  configuring the CLI for first use.\n"));
        process.stderr.write("\n");

        // Step 1: Environment
        process.stderr.write(c().bold.cyan("  1/4 ") + c().bold("Environment\n"));
        process.stderr.write(c().dim("  Choose which GRVT environment to connect to.\n"));
        process.stderr.write(c().dim("  Options: dev, staging, testnet, prod\n\n"));

        let env: GrvtEnvironment = config.env;
        while (true) {
          const envInput = await askWithDefault(rl, "  Environment:", config.env);
          if (VALID_ENVS.includes(envInput as GrvtEnvironment)) {
            env = envInput as GrvtEnvironment;
            break;
          }
          process.stderr.write(c().red(`  Invalid environment: ${envInput}. Use one of: ${VALID_ENVS.join(", ")}\n`));
        }

        config.env = env;
        saveConfig(config);
        process.stderr.write(c().green(`  ✓ Environment set to ${env}\n\n`));

        // Step 2: API Key
        process.stderr.write(c().bold.cyan("  2/4 ") + c().bold("API Key\n"));
        process.stderr.write(c().dim("  Your GRVT API key for authentication.\n"));
        process.stderr.write(c().dim("  Create one at https://grvt.io → Settings → API Keys\n\n"));

        const currentApiKey = config.apiKey ? `${config.apiKey.slice(0, 4)}****` : "none";
        const apiKey = await ask(rl, `  API Key ${c().dim(`(current: ${currentApiKey}, press Enter to skip)`)} `);

        if (apiKey) {
          config.apiKey = apiKey;
          saveConfig(config);
          process.stderr.write(c().green("  ✓ API key saved\n\n"));
        } else if (config.apiKey) {
          process.stderr.write(c().dim("  ✓ Keeping existing API key\n\n"));
        } else {
          process.stderr.write(c().yellow("  ⚠ Skipped — you can set it later with: grvt config set apiKey <key>\n\n"));
        }

        // Step 3: Private Key
        process.stderr.write(c().bold.cyan("  3/4 ") + c().bold("Private Key\n"));
        process.stderr.write(c().dim("  Your Ethereum private key for EIP-712 signing.\n"));
        process.stderr.write(c().dim("  Required for: order creation, transfers, withdrawals, derisk.\n"));
        process.stderr.write(c().dim("  Stored locally with 0600 file permissions.\n\n"));

        const currentPk = config.privateKey ? `${config.privateKey.slice(0, 6)}****` : "none";
        const privateKey = await ask(rl, `  Private Key ${c().dim(`(current: ${currentPk}, press Enter to skip)`)} `);

        if (privateKey) {
          const normalizedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
          config.privateKey = normalizedKey;
          saveConfig(config);
          process.stderr.write(c().green("  ✓ Private key saved\n\n"));
        } else if (config.privateKey) {
          process.stderr.write(c().dim("  ✓ Keeping existing private key\n\n"));
        } else {
          process.stderr.write(c().yellow("  ⚠ Skipped — you can set it later with: grvt config set privateKey <key>\n\n"));
        }

        // Step 4: Sub-account ID
        process.stderr.write(c().bold.cyan("  4/4 ") + c().bold("Default Sub-Account ID\n"));
        process.stderr.write(c().dim("  Your default sub-account for trading commands.\n"));
        process.stderr.write(c().dim("  Saves you from passing --sub-account-id every time.\n\n"));

        const currentSub = config.subAccountId ?? "none";
        const subAccountId = await ask(rl, `  Sub-Account ID ${c().dim(`(current: ${currentSub}, press Enter to skip)`)} `);

        if (subAccountId) {
          config.subAccountId = subAccountId;
          saveConfig(config);
          process.stderr.write(c().green(`  ✓ Default sub-account set to ${subAccountId}\n\n`));
        } else if (config.subAccountId) {
          process.stderr.write(c().dim("  ✓ Keeping existing sub-account ID\n\n"));
        } else {
          process.stderr.write(c().yellow("  ⚠ Skipped — you can set it later with: grvt config set subAccountId <id>\n\n"));
        }

        rl.close();

        // Attempt login if API key is available
        const finalConfig = loadConfig();
        if (finalConfig.apiKey) {
          process.stderr.write(c().dim("  ─────────────────────────────────────\n"));
          process.stderr.write(c().bold("  Authenticating...\n"));

          try {
            const result = await login({
              apiKey: finalConfig.apiKey,
              env: finalConfig.env,
              privateKey: finalConfig.privateKey,
            });
            process.stderr.write(c().green(`  ✓ Logged in on ${result.env} (account: ${result.accountId})\n`));
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(c().red(`  ✗ Login failed: ${msg}\n`));
            process.stderr.write(c().dim("  You can retry with: grvt auth login\n"));
          }
        }

        // Summary
        process.stderr.write("\n");
        process.stderr.write(c().dim("  ─────────────────────────────────────\n"));
        process.stderr.write(c().bold.green("  Setup complete!\n\n"));

        const summary = loadConfig();
        process.stderr.write(`  Environment:    ${c().bold(summary.env)}\n`);
        process.stderr.write(`  API Key:        ${summary.apiKey ? c().green("configured") : c().yellow("not set")}\n`);
        process.stderr.write(`  Private Key:    ${summary.privateKey ? c().green("configured") : c().yellow("not set")}\n`);
        process.stderr.write(`  Sub-Account:    ${summary.subAccountId ? c().bold(summary.subAccountId) : c().yellow("not set")}\n`);
        process.stderr.write(`  Session:        ${summary.cookie ? c().green("active") : c().yellow("inactive")}\n`);
        process.stderr.write("\n");
        process.stderr.write(c().dim("  Config file: ") + c().dim.underline("~/.config/grvt/config.toml\n"));
        process.stderr.write(c().dim("  Run `grvt --help` to see all available commands.\n"));
        process.stderr.write("\n");

        // Verify session works
        if (summary.cookie) {
          try {
            const status = await verifySession();
            if (status.valid) {
              process.stderr.write(c().dim("  Quick check: ") + c().green("session is valid ✓\n\n"));
            }
          } catch {
            // silently ignore verification errors
          }
        }
      } catch (error) {
        rl.close();
        handleCommandError(error);
      }
    });
};
