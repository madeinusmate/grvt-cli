import { extractAuthFromResponse } from "../client/http.js";
import { loadConfig, saveConfig } from "../config/store.js";
import type { GrvtEnvironment } from "../client/endpoints.js";

export interface LoginOptions {
  apiKey: string;
  env?: GrvtEnvironment;
  privateKey?: string;
}

export const performLogin = async (options: LoginOptions): Promise<{ accountId: string; env: GrvtEnvironment }> => {
  const config = loadConfig();
  const env = options.env ?? config.env;

  const { cookie, accountId } = await extractAuthFromResponse(env, options.apiKey);

  saveConfig({
    ...config,
    env,
    apiKey: options.apiKey,
    cookie,
    accountId,
    ...(options.privateKey ? { privateKey: options.privateKey } : {}),
  });

  return { accountId, env };
};
