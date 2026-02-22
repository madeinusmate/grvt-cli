import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

describe("config store", () => {
  let tempDir: string;
  const originalXdg = process.env["XDG_CONFIG_HOME"];

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "grvt-test-"));
    process.env["XDG_CONFIG_HOME"] = tempDir;
  });

  afterEach(() => {
    if (originalXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = originalXdg;
    } else {
      delete process.env["XDG_CONFIG_HOME"];
    }
    vi.restoreAllMocks();
  });

  it("loadConfig returns defaults when no config file exists", async () => {
    const { loadConfig } = await import("../../src/core/config/store.js");
    const config = loadConfig();
    expect(config.env).toBe("prod");
    expect(config.http.retries).toBe(3);
  });

  it("saveConfig creates config file and loadConfig reads it back", async () => {
    const { loadConfig, saveConfig } = await import("../../src/core/config/store.js");

    const config = loadConfig();
    config.env = "testnet";
    config.apiKey = "test-key";
    saveConfig(config);

    const reloaded = loadConfig();
    expect(reloaded.env).toBe("testnet");
    expect(reloaded.apiKey).toBe("test-key");
  });

  it("config file is created with 0600 permissions", async () => {
    const { loadConfig, saveConfig, configPath } = await import("../../src/core/config/store.js");

    saveConfig(loadConfig());
    const path = configPath();
    const stats = statSync(path);
    const mode = stats.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("setConfigValue sets nested keys", async () => {
    const { setConfigValue } = await import("../../src/core/config/store.js");
    const { DEFAULT_CONFIG } = await import("../../src/core/config/schema.js");

    const updated = setConfigValue(DEFAULT_CONFIG, "http.timeoutMs", "5000");
    expect(updated.http.timeoutMs).toBe(5000);
  });

  it("setConfigValue handles boolean coercion", async () => {
    const { setConfigValue } = await import("../../src/core/config/store.js");
    const { DEFAULT_CONFIG } = await import("../../src/core/config/schema.js");

    const updated = setConfigValue(DEFAULT_CONFIG, "outputDefaults.pretty", "true");
    expect(updated.outputDefaults.pretty).toBe(true);
  });

  it("unsetConfigValue removes a key", async () => {
    const { setConfigValue, unsetConfigValue } = await import("../../src/core/config/store.js");
    const { DEFAULT_CONFIG } = await import("../../src/core/config/schema.js");

    const withKey = setConfigValue(DEFAULT_CONFIG, "apiKey", "my-key");
    expect(withKey.apiKey).toBe("my-key");

    const without = unsetConfigValue(withKey, "apiKey");
    expect(without.apiKey).toBeUndefined();
  });

  it("getConfigValue retrieves nested values", async () => {
    const { getConfigValue } = await import("../../src/core/config/store.js");
    const { configSchema } = await import("../../src/core/config/schema.js");

    const freshConfig = configSchema.parse({});
    expect(getConfigValue(freshConfig, "env")).toBe("prod");
    expect(getConfigValue(freshConfig, "http.timeoutMs")).toBe(10000);
    expect(getConfigValue(freshConfig, "nonexistent")).toBeUndefined();
  });
});
