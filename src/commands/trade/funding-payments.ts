import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import { paginateCursor } from "../../core/pagination/cursor.js";
import { parseTimestamp } from "../../core/safety/validate.js";
import type { PaginatedRequest, ApiResponse, Kind } from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

export const getFundingPayments = async (
  client: HttpClient,
  params: PaginatedRequest,
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.trading.fundingPaymentHistory, params);
};

export const registerFundingPaymentCommands = (parent: Command) => {
  parent
    .command("funding-payments")
    .description("Get funding payment history")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--kind <kinds>", "filter by kind (comma-separated)")
    .option("--base <currencies>", "filter by base currency")
    .option("--quote <currencies>", "filter by quote currency")
    .option("--start-time <time>", "start time")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max results")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);

      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: PaginatedRequest = {
            sub_account_id: subAccountId,
            ...(opts["kind"] ? { kind: (opts["kind"] as string).split(",") as Kind[] } : {} as Record<string, never>),
            ...(opts["base"] ? { base: (opts["base"] as string).split(",") } : {} as Record<string, never>),
            ...(opts["quote"] ? { quote: (opts["quote"] as string).split(",") } : {} as Record<string, never>),
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {} as Record<string, never>),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {} as Record<string, never>),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {} as Record<string, never>),
            ...(cursor ? { cursor } : {} as Record<string, never>),
          };
          const resp = await getFundingPayments(ctx.client, body);
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
