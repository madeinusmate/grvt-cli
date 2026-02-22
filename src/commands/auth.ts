import { Command } from "commander";
import { login, logout, verifySession } from "../core/auth/session.js";
import { loadConfig } from "../core/config/store.js";
import { getGlobalOpts } from "../core/command-helpers.js";
import { resolveOutputOptions, printOutput, logInfo } from "../core/output/format.js";
import { handleCommandError, exitUsage } from "../core/output/errors.js";
import { disableColors } from "../core/output/colors.js";
import { c } from "../core/output/colors.js";
import type { GrvtEnvironment } from "../core/client/endpoints.js";

export const registerAuthCommands = (program: Command) => {
  const authCmd = program.command("auth").description("Authentication and session management");

  authCmd
    .command("login")
    .description("Authenticate with GRVT API")
    .option("--api-key <key>", "GRVT API key")
    .option("--private-key <key>", "Ethereum private key for order signing")
    .option("--env <environment>", "environment: dev|staging|testnet|prod")
    .action(async (opts: { apiKey?: string; privateKey?: string; env?: string }, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();

        const config = loadConfig();
        const apiKey = opts.apiKey ?? config.apiKey;
        if (!apiKey) {
          return exitUsage("--api-key is required (or set apiKey in config)");
        }

        const env = (opts.env as GrvtEnvironment) ?? config.env;
        logInfo(`Logging in to ${env}...`, Boolean(globalOpts["silent"]));

        const result = await login({ apiKey, env, privateKey: opts.privateKey });

        logInfo(c().green(`Authenticated on ${result.env} (accountId: ${result.accountId})`), Boolean(globalOpts["silent"]));
      } catch (error) {
        handleCommandError(error);
      }
    });

  authCmd
    .command("status")
    .description("Check if current session is valid")
    .action(async (_opts: unknown, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();
        const outputOptions = resolveOutputOptions(globalOpts);

        const status = await verifySession();
        printOutput(status, outputOptions);
      } catch (error) {
        handleCommandError(error);
      }
    });

  authCmd
    .command("logout")
    .description("Clear stored credentials and session")
    .action(async (_opts: unknown, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();

        logout();
        logInfo(c().green("Logged out."), Boolean(globalOpts["silent"]));
      } catch (error) {
        handleCommandError(error);
      }
    });

  authCmd
    .command("whoami")
    .description("Show current account info")
    .action(async (_opts: unknown, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();
        const outputOptions = resolveOutputOptions(globalOpts);

        const config = loadConfig();
        printOutput({
          env: config.env,
          accountId: config.accountId ?? "not set",
          subAccountId: config.subAccountId ?? "not set",
          hasApiKey: Boolean(config.apiKey),
          hasPrivateKey: Boolean(config.privateKey),
          hasSession: Boolean(config.cookie),
        }, outputOptions);
      } catch (error) {
        handleCommandError(error);
      }
    });
};
