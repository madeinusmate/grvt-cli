import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml";
import {
  configPath,
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  unsetConfigValue,
} from "../core/config/store.js";
import { redactConfig, SECRET_KEYS } from "../core/config/schema.js";
import { getGlobalOpts } from "../core/command-helpers.js";
import { resolveOutputOptions, printOutput } from "../core/output/format.js";
import { confirm } from "../core/safety/confirm.js";
import { handleCommandError, exitUsage } from "../core/output/errors.js";
import { disableColors } from "../core/output/colors.js";

export const registerConfigCommands = (program: Command) => {
  const configCmd = program.command("config").description("Manage local configuration");

  configCmd
    .command("path")
    .description("Print the config file path")
    .action(() => {
      process.stdout.write(configPath() + "\n");
    });

  configCmd
    .command("get")
    .argument("[key]", "config key (dot-notation)")
    .description("Get a config value")
    .action(async (key: string | undefined, _opts: unknown, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();
        const outputOptions = resolveOutputOptions(globalOpts);
        const config = loadConfig();

        if (!key) {
          printOutput(redactConfig(config), outputOptions);
          return;
        }

        const value = getConfigValue(config, key);
        if (value === undefined) {
          exitUsage(`Key not found: ${key}`);
        }

        if (SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number])) {
          printOutput("****", outputOptions);
        } else {
          printOutput(value, outputOptions);
        }
      } catch (error) {
        handleCommandError(error);
      }
    });

  configCmd
    .command("set")
    .argument("<key>", "config key (dot-notation)")
    .argument("<value>", "value to set")
    .description("Set a config value")
    .action(async (key: string, value: string) => {
      try {
        const config = loadConfig();
        const updated = setConfigValue(config, key, value);
        saveConfig(updated);
        process.stderr.write(`Set ${key}\n`);
      } catch (error) {
        handleCommandError(error);
      }
    });

  configCmd
    .command("unset")
    .argument("<key>", "config key to unset")
    .description("Unset a config value")
    .action(async (key: string) => {
      try {
        const config = loadConfig();
        const updated = unsetConfigValue(config, key);
        saveConfig(updated);
        process.stderr.write(`Unset ${key}\n`);
      } catch (error) {
        handleCommandError(error);
      }
    });

  configCmd
    .command("list")
    .description("List all config values (secrets redacted)")
    .action(async (_opts: unknown, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        if (globalOpts["color"] === false) disableColors();
        const outputOptions = resolveOutputOptions(globalOpts);
        printOutput(redactConfig(loadConfig()), outputOptions);
      } catch (error) {
        handleCommandError(error);
      }
    });

  configCmd
    .command("export")
    .requiredOption("--file <path>", "path to export to")
    .option("--include-secrets", "include secret values (apiKey, privateKey, cookie)")
    .option("--yes", "skip confirmation")
    .description("Export config to a file")
    .action(async (opts: { file: string; includeSecrets?: boolean; yes?: boolean }, cmd: Command) => {
      try {
        const globalOpts = getGlobalOpts(cmd);
        const skipConfirm = Boolean(opts.yes || globalOpts["yes"]);
        const config = loadConfig();

        if (opts.includeSecrets) {
          const ok = await confirm("Export includes secrets. Continue?", skipConfirm);
          if (!ok) {
            process.stderr.write("Aborted.\n");
            return;
          }
          const toml = stringifyTOML(config as Record<string, unknown>);
          writeFileSync(opts.file, toml, "utf-8");
        } else {
          const toml = stringifyTOML(redactConfig(config));
          writeFileSync(opts.file, toml, "utf-8");
        }

        process.stderr.write(`Exported to ${opts.file}\n`);
      } catch (error) {
        handleCommandError(error);
      }
    });

  configCmd
    .command("import")
    .requiredOption("--file <path>", "path to import from")
    .description("Import config from a file")
    .action(async (opts: { file: string }) => {
      try {
        const raw = readFileSync(opts.file, "utf-8");
        const parsed = parseTOML(raw);
        const { configSchema } = await import("../core/config/schema.js");
        const validated = configSchema.parse(parsed);
        saveConfig(validated);
        process.stderr.write(`Imported from ${opts.file}\n`);
      } catch (error) {
        handleCommandError(error);
      }
    });
};
