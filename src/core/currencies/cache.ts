import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHttpClient } from "../client/http.js";
import { ENDPOINTS, type GrvtEnvironment } from "../client/endpoints.js";

export interface CurrencyDetail {
  id: number;
  symbol: string;
  balance_decimals: number;
  quantity_multiplier: string;
}

interface CurrencyCache {
  env: string;
  fetched_at: number;
  currencies: Record<string, CurrencyDetail>;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

const getCacheDir = (): string => {
  const xdgCache = process.env["XDG_CACHE_HOME"];
  const base = xdgCache || join(homedir(), ".cache");
  return join(base, "grvt");
};

const getCachePath = (env: GrvtEnvironment): string =>
  join(getCacheDir(), `currencies-${env}.json`);

const loadCache = (env: GrvtEnvironment): CurrencyCache | null => {
  const path = getCachePath(env);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const cache = JSON.parse(raw) as CurrencyCache;
    if (cache.env !== env || Date.now() - cache.fetched_at > CACHE_TTL_MS) {
      return null;
    }
    return cache;
  } catch {
    return null;
  }
};

const saveCache = (env: GrvtEnvironment, currencies: Record<string, CurrencyDetail>): void => {
  const dir = getCacheDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const cache: CurrencyCache = { env, fetched_at: Date.now(), currencies };
  writeFileSync(getCachePath(env), JSON.stringify(cache), "utf-8");
};

export const getCurrencies = async (env: GrvtEnvironment, cookie?: string, accountId?: string): Promise<Record<string, CurrencyDetail>> => {
  const cached = loadCache(env);
  if (cached) return cached.currencies;

  const client = createHttpClient({ env, cookie, accountId });
  const response = await client.post<{ result: CurrencyDetail[] }>(
    "marketData",
    ENDPOINTS.marketData.currency,
    {},
  );

  const currencies: Record<string, CurrencyDetail> = {};
  for (const cur of response.result ?? []) {
    currencies[cur.symbol] = cur;
  }

  saveCache(env, currencies);
  return currencies;
};

export const getCurrencyId = async (
  env: GrvtEnvironment,
  symbol: string,
  cookie?: string,
  accountId?: string,
): Promise<number> => {
  const currencies = await getCurrencies(env, cookie, accountId);
  const cur = currencies[symbol.toUpperCase()];
  if (!cur) {
    throw new Error(`Currency not found: ${symbol}. Run 'grvt market currency' to see available currencies.`);
  }
  return cur.id;
};

export const getCurrencyDecimals = async (
  env: GrvtEnvironment,
  symbol: string,
  cookie?: string,
  accountId?: string,
): Promise<number> => {
  const currencies = await getCurrencies(env, cookie, accountId);
  const cur = currencies[symbol.toUpperCase()];
  if (!cur) {
    throw new Error(`Currency not found: ${symbol}. Run 'grvt market currency' to see available currencies.`);
  }
  return cur.balance_decimals;
};
