import { describe, it, expect } from "vitest";
import { configSchema, redactConfig, DEFAULT_CONFIG, type GrvtConfig } from "../../src/core/config/schema.js";

describe("configSchema", () => {
  it("parses empty object to defaults", () => {
    const result = configSchema.parse({});
    expect(result.env).toBe("prod");
    expect(result.http.timeoutMs).toBe(10000);
    expect(result.http.retries).toBe(3);
    expect(result.outputDefaults.output).toBe("table");
  });

  it("accepts valid environment values", () => {
    for (const env of ["dev", "staging", "testnet", "prod"] as const) {
      const result = configSchema.parse({ env });
      expect(result.env).toBe(env);
    }
  });

  it("rejects invalid environment value", () => {
    expect(() => configSchema.parse({ env: "invalid" })).toThrow();
  });

  it("accepts partial config with overrides", () => {
    const result = configSchema.parse({
      env: "testnet",
      apiKey: "my-key",
      subAccountId: "12345",
      http: { timeoutMs: 5000 },
    });
    expect(result.env).toBe("testnet");
    expect(result.apiKey).toBe("my-key");
    expect(result.subAccountId).toBe("12345");
    expect(result.http.timeoutMs).toBe(5000);
    expect(result.http.retries).toBe(3); // default
  });

  it("accepts all output format values", () => {
    for (const output of ["json", "ndjson", "table", "raw"] as const) {
      const result = configSchema.parse({ outputDefaults: { output } });
      expect(result.outputDefaults.output).toBe(output);
    }
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has expected defaults", () => {
    expect(DEFAULT_CONFIG.env).toBe("prod");
    expect(DEFAULT_CONFIG.apiKey).toBeUndefined();
    expect(DEFAULT_CONFIG.privateKey).toBeUndefined();
    expect(DEFAULT_CONFIG.cookie).toBeUndefined();
  });
});

describe("redactConfig", () => {
  it("redacts apiKey", () => {
    const config: GrvtConfig = {
      ...DEFAULT_CONFIG,
      apiKey: "super-secret-api-key-12345",
    };
    const redacted = redactConfig(config);
    expect(redacted["apiKey"]).toBe("supe****2345");
    expect(redacted["apiKey"]).not.toContain("super-secret");
  });

  it("redacts privateKey", () => {
    const config: GrvtConfig = {
      ...DEFAULT_CONFIG,
      privateKey: "0xabcdef1234567890abcdef",
    };
    const redacted = redactConfig(config);
    expect(redacted["privateKey"]).toBe("0xab****cdef");
  });

  it("redacts cookie", () => {
    const config: GrvtConfig = {
      ...DEFAULT_CONFIG,
      cookie: "gravity=longcookievaluehere",
    };
    const redacted = redactConfig(config);
    expect(redacted["cookie"]).toBe("grav****here");
  });

  it("handles short secret values", () => {
    const config: GrvtConfig = {
      ...DEFAULT_CONFIG,
      apiKey: "short",
    };
    const redacted = redactConfig(config);
    expect(redacted["apiKey"]).toBe("****");
  });

  it("does not redact non-secret fields", () => {
    const config: GrvtConfig = {
      ...DEFAULT_CONFIG,
      env: "testnet",
      subAccountId: "12345",
    };
    const redacted = redactConfig(config);
    expect(redacted["env"]).toBe("testnet");
    expect(redacted["subAccountId"]).toBe("12345");
  });
});
