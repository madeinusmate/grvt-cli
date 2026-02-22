import { loadConfig, saveConfig } from "../config/store.js";
import { createHttpClient } from "../client/http.js";
import { ENDPOINTS } from "../client/endpoints.js";
import { performLogin, type LoginOptions } from "./login.js";

export const login = async (options: LoginOptions) => performLogin(options);

export const logout = (): void => {
  const config = loadConfig();
  saveConfig({
    ...config,
    apiKey: undefined,
    privateKey: undefined,
    cookie: undefined,
    accountId: undefined,
  });
};

export const verifySession = async (): Promise<{ valid: boolean; env: string; accountId?: string }> => {
  const config = loadConfig();

  if (!config.cookie || !config.accountId) {
    return { valid: false, env: config.env };
  }

  try {
    const client = createHttpClient({
      env: config.env,
      cookie: config.cookie,
      accountId: config.accountId,
      timeoutMs: config.http.timeoutMs,
    });

    await client.post("trading", ENDPOINTS.account.fundingAccountSummary, {});
    return { valid: true, env: config.env, accountId: config.accountId };
  } catch {
    return { valid: false, env: config.env, accountId: config.accountId };
  }
};

export const getAuthenticatedClient = () => {
  const config = loadConfig();

  if (!config.cookie || !config.accountId) {
    throw new Error("Not authenticated. Run `grvt auth login` first.");
  }

  return {
    client: createHttpClient({
      env: config.env,
      cookie: config.cookie,
      accountId: config.accountId,
      timeoutMs: config.http.timeoutMs,
      retries: config.http.retries,
      backoffMs: config.http.backoffMs,
      maxBackoffMs: config.http.maxBackoffMs,
    }),
    config,
  };
};
