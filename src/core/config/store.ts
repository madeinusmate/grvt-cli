import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse as parseTOML, stringify as stringifyTOML } from "smol-toml";
import { configSchema, DEFAULT_CONFIG, type GrvtConfig } from "./schema.js";

const getConfigDir = (): string => {
  const xdgConfig = process.env["XDG_CONFIG_HOME"];
  const base = xdgConfig || join(homedir(), ".config");
  return join(base, "grvt");
};

const getConfigPath = (): string => join(getConfigDir(), "config.toml");

export const configPath = (): string => getConfigPath();

export const loadConfig = (): GrvtConfig => {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = parseTOML(raw);
  return configSchema.parse(parsed);
};

export const saveConfig = (config: GrvtConfig): void => {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const path = getConfigPath();
  const toml = stringifyTOML(config as Record<string, unknown>);
  writeFileSync(path, toml, { mode: 0o600 });

  try {
    chmodSync(path, 0o600);
  } catch {
    // best-effort on platforms that don't support chmod
  }
};

export const getConfigValue = (config: GrvtConfig, key: string): unknown => {
  const parts = key.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

export const setConfigValue = (config: GrvtConfig, key: string, value: string): GrvtConfig => {
  const parts = key.split(".");
  const clone = structuredClone(config) as Record<string, unknown>;
  let current = clone;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastKey = parts[parts.length - 1]!;
  const coerced = coerceValue(value, key);
  current[lastKey] = coerced;

  return configSchema.parse(clone);
};

export const unsetConfigValue = (config: GrvtConfig, key: string): GrvtConfig => {
  const parts = key.split(".");
  const clone = structuredClone(config) as Record<string, unknown>;
  let current = clone;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== "object" || current[part] === null) {
      return config;
    }
    current = current[part] as Record<string, unknown>;
  }

  delete current[parts[parts.length - 1]!];
  return configSchema.parse(clone);
};

const NUMERIC_KEYS = new Set([
  "http.timeoutMs",
  "http.retries",
  "http.backoffMs",
  "http.maxBackoffMs",
]);

const BOOLEAN_KEYS = new Set([
  "outputDefaults.pretty",
  "outputDefaults.silent",
]);

const coerceValue = (value: string, key: string): unknown => {
  if (BOOLEAN_KEYS.has(key) || value === "true" || value === "false") {
    return value === "true";
  }
  if (NUMERIC_KEYS.has(key)) {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return value;
};
