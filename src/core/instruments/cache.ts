import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHttpClient } from "../client/http.js";
import { ENDPOINTS, type GrvtEnvironment } from "../client/endpoints.js";

export interface InstrumentMetadata {
  instrument: string;
  instrument_hash: string;
  base: string;
  quote: string;
  kind: string;
  venues: string[];
  tick_size: string;
  min_size: string;
  [key: string]: unknown;
}

interface InstrumentCache {
  env: string;
  fetched_at: number;
  instruments: Record<string, InstrumentMetadata>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const getCacheDir = (): string => {
  const xdgCache = process.env["XDG_CACHE_HOME"];
  const base = xdgCache || join(homedir(), ".cache");
  return join(base, "grvt");
};

const getCachePath = (env: GrvtEnvironment): string =>
  join(getCacheDir(), `instruments-${env}.json`);

const loadCache = (env: GrvtEnvironment): InstrumentCache | null => {
  const path = getCachePath(env);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const cache = JSON.parse(raw) as InstrumentCache;

    if (cache.env !== env || Date.now() - cache.fetched_at > CACHE_TTL_MS) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
};

const saveCache = (env: GrvtEnvironment, instruments: Record<string, InstrumentMetadata>): void => {
  const dir = getCacheDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const cache: InstrumentCache = {
    env,
    fetched_at: Date.now(),
    instruments,
  };

  writeFileSync(getCachePath(env), JSON.stringify(cache), "utf-8");
};

export const getInstruments = async (env: GrvtEnvironment, cookie?: string, accountId?: string): Promise<Record<string, InstrumentMetadata>> => {
  const cached = loadCache(env);
  if (cached) return cached.instruments;

  const client = createHttpClient({ env, cookie, accountId });
  const response = await client.post<{ result: InstrumentMetadata[] }>(
    "marketData",
    ENDPOINTS.marketData.allInstruments,
    { is_active: true },
  );

  const instruments: Record<string, InstrumentMetadata> = {};
  for (const inst of response.result ?? []) {
    instruments[inst.instrument] = inst;
  }

  saveCache(env, instruments);
  return instruments;
};

export const getInstrument = async (
  env: GrvtEnvironment,
  instrument: string,
  cookie?: string,
  accountId?: string,
): Promise<InstrumentMetadata> => {
  const instruments = await getInstruments(env, cookie, accountId);
  const meta = instruments[instrument];
  if (!meta) {
    throw new Error(`Instrument not found: ${instrument}. Run 'grvt market instruments' to see available instruments.`);
  }
  return meta;
};
