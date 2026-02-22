import type { Command } from "commander";
import { loadConfig } from "./config/store.js";
import { createHttpClient, type HttpClient } from "./client/http.js";
import { resolveOutputOptions, printOutput, type OutputOptions } from "./output/format.js";
import { handleCommandError, exitAuth } from "./output/errors.js";
import { disableColors } from "./output/colors.js";
import type { GrvtConfig } from "./config/schema.js";

export interface CommandContext {
  config: GrvtConfig;
  client: HttpClient;
  outputOptions: OutputOptions;
  globalOpts: Record<string, unknown>;
}

export const getGlobalOpts = (cmd: Command): Record<string, unknown> => {
  let root = cmd;
  while (root.parent) {
    root = root.parent;
  }
  return root.opts();
};

export const resolveContext = (cmd: Command, requireAuth = true): CommandContext => {
  const globalOpts = getGlobalOpts(cmd);

  if (globalOpts["color"] === false) {
    disableColors();
  }

  const config = loadConfig();
  const outputOptions = resolveOutputOptions(globalOpts);
  const timeoutMs = Number(globalOpts["timeoutMs"]) || config.http.timeoutMs;
  const retries = Number(globalOpts["retries"]) || config.http.retries;

  if (requireAuth && (!config.cookie || !config.accountId)) {
    exitAuth("Not authenticated. Run `grvt auth login` first.");
  }

  const client = createHttpClient({
    env: config.env,
    cookie: config.cookie,
    accountId: config.accountId,
    timeoutMs,
    retries,
    backoffMs: config.http.backoffMs,
    maxBackoffMs: config.http.maxBackoffMs,
  });

  return { config, client, outputOptions, globalOpts };
};

export const wrapAction = (requireAuth: boolean, action: (ctx: CommandContext, opts: Record<string, unknown>, cmd: Command) => Promise<void>) =>
  async (...args: unknown[]) => {
    const cmd = args[args.length - 1] as Command;
    const opts = cmd.opts() as Record<string, unknown>;
    try {
      const ctx = resolveContext(cmd, requireAuth);
      await action(ctx, opts, cmd);
    } catch (error) {
      handleCommandError(error);
    }
  };

export const output = (data: unknown, opts: OutputOptions): void => {
  printOutput(data, opts);
};

export const resolveSubAccountId = (opts: Record<string, unknown>, config: GrvtConfig): string => {
  const id = (opts["subAccountId"] as string) ?? config.subAccountId;
  if (!id) {
    exitAuth("--sub-account-id is required (or set subAccountId in config)");
  }
  return id;
};
