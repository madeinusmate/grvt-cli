import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output } from "../../core/command-helpers.js";
import { paginateCursor } from "../../core/pagination/cursor.js";
import { parseTimestamp } from "../../core/safety/validate.js";
import type { HistoryRequest, ApiResponse } from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

export const createDeposit = async (
  _client: HttpClient,
  _params: unknown,
): Promise<unknown> => {
  throw new Error("Deposit creation is not available via REST API. Use the GRVT web interface.");
};

export const getDepositHistory = async (
  client: HttpClient,
  params: HistoryRequest,
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.funds.depositHistory, params);
};

export const registerDepositCommands = (parent: Command) => {
  const depositCmd = parent.command("deposit").description("Deposit management");

  depositCmd
    .command("history")
    .description("Get deposit history")
    .option("--start-time <time>", "start time")
    .option("--end-time <time>", "end time")
    .option("--limit <n>", "max results")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--all", "auto-paginate all results")
    .action(wrapAction(true, async (ctx, opts) => {
      const results = await paginateCursor({
        fetchPage: async (cursor) => {
          const body: HistoryRequest = {
            ...(opts["startTime"] ? { start_time: parseTimestamp(opts["startTime"] as string) } : {}),
            ...(opts["endTime"] ? { end_time: parseTimestamp(opts["endTime"] as string) } : {}),
            ...(opts["limit"] ? { limit: Number(opts["limit"]) } : {}),
            ...(cursor ? { cursor } : {}),
          };
          const resp = await getDepositHistory(ctx.client, body);
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
