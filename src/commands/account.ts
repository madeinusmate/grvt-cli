import { Command } from "commander";
import { ENDPOINTS } from "../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../core/command-helpers.js";
import { paginateCursor } from "../core/pagination/cursor.js";
import { parseTimestamp } from "../core/safety/validate.js";
import type { ApiResponse } from "../core/client/types.js";

export const getFundingAccountSummary = async (client: { post: <T>(base: "edge" | "marketData" | "trading", path: string, body?: unknown) => Promise<T> }) => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.account.fundingAccountSummary, {});
  return result.result;
};

export const getSubAccountSummary = async (
  client: { post: <T>(base: "edge" | "marketData" | "trading", path: string, body?: unknown) => Promise<T> },
  subAccountId: string,
) => {
  const body = { sub_account_id: subAccountId };
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.account.accountSummary, body);
  return result.result;
};

export const getSubAccountHistory = getSubAccountSummary;

export const getAccountHistory = async (
  client: { post: <T>(base: "edge" | "marketData" | "trading", path: string, body?: unknown) => Promise<T> },
  params: { sub_account_id: string; start_time?: string; end_time?: string; limit?: number; cursor?: string },
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.account.accountHistory, params);
};

export const getAggregatedAccountSummary = async (
  client: { post: <T>(base: "edge" | "marketData" | "trading", path: string, body?: unknown) => Promise<T> },
) => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.account.aggregatedAccountSummary, {});
  return result.result;
};

export const registerAccountCommands = (program: Command) => {
  const accountCmd = program.command("account").description("Account summaries and sub-account info");

  accountCmd
    .command("funding")
    .description("Get funding account summary")
    .action(wrapAction(true, async (ctx) => {
      const result = await getFundingAccountSummary(ctx.client);
      output(result, ctx.outputOptions);
    }));

  accountCmd
    .command("summary")
    .description("Get sub-account summary")
    .option("--sub-account-id <id>", "sub-account ID")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const result = await getSubAccountSummary(ctx.client, subAccountId);
      output(result, ctx.outputOptions);
    }));

  accountCmd
    .command("aggregated")
    .description("Get aggregated account summary across all sub-accounts")
    .action(wrapAction(true, async (ctx) => {
      const result = await getAggregatedAccountSummary(ctx.client);
      output(result, ctx.outputOptions);
    }));

  accountCmd
    .command("history")
    .description("Get hourly snapshots of sub-account state")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--start-time <time>", "start time (unix seconds, ms, ns, or ISO)")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max results per page")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);

      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: Record<string, unknown> = {
            sub_account_id: subAccountId,
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {}),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {}),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
            ...(cursor ? { cursor } : {}),
          };
          const resp = await getAccountHistory(ctx.client, body as Parameters<typeof getAccountHistory>[1]);
          return { result: resp.result ?? [], next: resp.next };
        },
        cursor: opts["cursor"] as string | undefined,
        all: Boolean(opts["all"]),
        outputOptions: ctx.outputOptions,
      });

      if (ctx.outputOptions.output !== "ndjson" || !opts["all"]) {
        output(results, ctx.outputOptions);
      }
    }));
};
