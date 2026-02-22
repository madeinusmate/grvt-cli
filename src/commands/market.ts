import { Command } from "commander";
import { ENDPOINTS } from "../core/client/endpoints.js";
import { wrapAction, output } from "../core/command-helpers.js";
import { paginateCursor } from "../core/pagination/cursor.js";
import { parseTimestamp } from "../core/safety/validate.js";
import type { ApiResponse, Kind } from "../core/client/types.js";

export const registerMarketCommands = (program: Command) => {
  const marketCmd = program.command("market").description("Market data (mostly unauthenticated)");

  marketCmd
    .command("instruments")
    .description("List instruments")
    .option("--kind <kinds>", "filter by kind (comma-separated: PERPETUAL,FUTURE,CALL,PUT)")
    .option("--base <currencies>", "filter by base currency (comma-separated)")
    .option("--quote <currencies>", "filter by quote currency (comma-separated)")
    .option("--active", "only active instruments", true)
    .option("--limit <n>", "max results")
    .action(wrapAction(false, async (ctx, opts) => {
      const hasFilters = opts["kind"] || opts["base"] || opts["quote"];
      const endpoint = hasFilters ? ENDPOINTS.marketData.instruments : ENDPOINTS.marketData.allInstruments;

      const body: Record<string, unknown> = {
        is_active: Boolean(opts["active"]),
        ...(opts["kind"] ? { kind: (opts["kind"] as string).split(",") as Kind[] } : {}),
        ...(opts["base"] ? { base: (opts["base"] as string).split(",") } : {}),
        ...(opts["quote"] ? { quote: (opts["quote"] as string).split(",") } : {}),
        ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
      };
      const result = await ctx.client.post<ApiResponse>("marketData", endpoint, body);
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("orderbook")
    .description("Get order book")
    .requiredOption("--instrument <name>", "instrument symbol")
    .option("--depth <n>", "depth: 10, 50, 100, 500", "10")
    .action(wrapAction(false, async (ctx, opts) => {
      const body = {
        instrument: opts["instrument"] as string,
        depth: Number(opts["depth"]),
      };
      const result = await ctx.client.post<ApiResponse>("marketData", ENDPOINTS.marketData.book, body);
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("trades")
    .description("Get trade history")
    .requiredOption("--instrument <name>", "instrument symbol")
    .option("--start-time <time>", "start time (unix seconds, ms, ns, or ISO)")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max trades")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(false, async (ctx, opts) => {
      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: Record<string, unknown> = {
            instrument: opts["instrument"] as string,
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {}),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {}),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
            ...(cursor ? { cursor } : {}),
          };
          const res = await ctx.client.post<ApiResponse<unknown[]>>("marketData", ENDPOINTS.marketData.tradeHistory, body);
          return { result: res.result ?? [], next: res.next };
        },
        cursor: opts["cursor"] as string | undefined,
        all: Boolean(opts["all"]),
        outputOptions: ctx.outputOptions,
      });

      if (ctx.outputOptions.output !== "ndjson" || !opts["all"]) {
        output(results, ctx.outputOptions);
      }
    }));

  marketCmd
    .command("candles")
    .description("Get candlestick (OHLCV) data")
    .requiredOption("--instrument <name>", "instrument symbol")
    .requiredOption("--interval <interval>", "candle interval (e.g. CI_1_M, CI_5_M, CI_1_H, CI_1_D)")
    .option("--type <type>", "price type: TRADE, MARK, INDEX, MID", "TRADE")
    .option("--start-time <time>", "start time")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max candles")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(false, async (ctx, opts) => {
      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: Record<string, unknown> = {
            instrument: opts["instrument"] as string,
            interval: opts["interval"] as string,
            type: (opts["type"] as string) ?? "TRADE",
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {}),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {}),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
            ...(cursor ? { cursor } : {}),
          };
          const res = await ctx.client.post<ApiResponse<unknown[]>>("marketData", ENDPOINTS.marketData.kline, body);
          return { result: res.result ?? [], next: res.next };
        },
        cursor: opts["cursor"] as string | undefined,
        all: Boolean(opts["all"]),
        outputOptions: ctx.outputOptions,
      });

      if (ctx.outputOptions.output !== "ndjson" || !opts["all"]) {
        output(results, ctx.outputOptions);
      }
    }));

  marketCmd
    .command("funding-rate")
    .description("Get funding rate history")
    .requiredOption("--instrument <name>", "instrument symbol")
    .option("--start-time <time>", "start time")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max entries")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(false, async (ctx, opts) => {
      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: Record<string, unknown> = {
            instrument: opts["instrument"] as string,
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {}),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {}),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
            ...(cursor ? { cursor } : {}),
          };
          const res = await ctx.client.post<ApiResponse<unknown[]>>("marketData", ENDPOINTS.marketData.funding, body);
          return { result: res.result ?? [], next: res.next };
        },
        cursor: opts["cursor"] as string | undefined,
        all: Boolean(opts["all"]),
        outputOptions: ctx.outputOptions,
      });

      if (ctx.outputOptions.output !== "ndjson" || !opts["all"]) {
        output(results, ctx.outputOptions);
      }
    }));

  marketCmd
    .command("instrument")
    .description("Get detailed metadata for a single instrument")
    .requiredOption("--instrument <name>", "instrument symbol (e.g. BTC_USDT_Perp)")
    .action(wrapAction(false, async (ctx, opts) => {
      const body = { instrument: opts["instrument"] as string };
      const result = await ctx.client.post<ApiResponse>("marketData", ENDPOINTS.marketData.instrument, body);
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("currency")
    .description("List all supported currencies with IDs and decimals")
    .action(wrapAction(false, async (ctx) => {
      const result = await ctx.client.post<ApiResponse>("marketData", ENDPOINTS.marketData.currency, {});
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("mini-ticker")
    .description("Get lightweight price info for an instrument")
    .requiredOption("--instrument <name>", "instrument symbol")
    .action(wrapAction(false, async (ctx, opts) => {
      const body = { instrument: opts["instrument"] as string };
      const result = await ctx.client.post<ApiResponse>("marketData", ENDPOINTS.marketData.mini, body);
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("ticker")
    .description("Get full ticker data for an instrument")
    .requiredOption("--instrument <name>", "instrument symbol")
    .option("--greeks", "include greeks data (for options)")
    .option("--derived", "include derived data")
    .action(wrapAction(false, async (ctx, opts) => {
      const body: Record<string, unknown> = {
        instrument: opts["instrument"] as string,
        ...(opts["greeks"] ? { greeks: true } : {}),
        ...(opts["derived"] ? { derived: true } : {}),
      };
      const result = await ctx.client.post<ApiResponse>("marketData", ENDPOINTS.marketData.ticker, body);
      output(result.result, ctx.outputOptions);
    }));

  marketCmd
    .command("margin-rules")
    .description("Get margin rules for an instrument")
    .requiredOption("--instrument <name>", "instrument symbol (e.g. BTC_USDT_Perp)")
    .action(wrapAction(false, async (ctx, opts) => {
      const body = { instrument: opts["instrument"] as string };
      const result = await ctx.client.post<Record<string, unknown>>("marketData", ENDPOINTS.marketData.marginRules, body);
      output(result, ctx.outputOptions);
    }));
};
