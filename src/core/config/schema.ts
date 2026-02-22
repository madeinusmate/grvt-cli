import { z } from "zod";

const environmentSchema = z.enum(["dev", "staging", "testnet", "prod"]);

const httpConfigSchema = z.object({
  timeoutMs: z.number().int().positive().default(10000),
  retries: z.number().int().min(0).default(3),
  backoffMs: z.number().int().positive().default(200),
  maxBackoffMs: z.number().int().positive().default(10000),
});

const outputDefaultsSchema = z.object({
  output: z.enum(["json", "ndjson", "table", "raw"]).default("table"),
  pretty: z.boolean().default(false),
  silent: z.boolean().default(false),
});

export const configSchema = z.object({
  env: environmentSchema.default("prod"),
  apiKey: z.string().optional(),
  privateKey: z.string().optional(),
  subAccountId: z.string().optional(),
  accountId: z.string().optional(),
  cookie: z.string().optional(),
  outputDefaults: outputDefaultsSchema.default({}),
  http: httpConfigSchema.default({}),
});

export type GrvtConfig = z.infer<typeof configSchema>;

export const SECRET_KEYS = ["apiKey", "privateKey", "cookie"] as const;

export const DEFAULT_CONFIG: GrvtConfig = configSchema.parse({});

export const redactConfig = (config: GrvtConfig): Record<string, unknown> => {
  const redacted = { ...config } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    if (redacted[key]) {
      const val = redacted[key] as string;
      redacted[key] = val.length > 8 ? val.slice(0, 4) + "****" + val.slice(-4) : "****";
    }
  }
  return redacted;
};
