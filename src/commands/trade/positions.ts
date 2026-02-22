import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import type { GetPositionsRequest, ApiResponse, Kind } from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

export const getPositions = async (
  client: HttpClient,
  params: GetPositionsRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.positions, params);
  return result.result;
};

export const registerPositionCommands = (parent: Command) => {
  parent
    .command("positions")
    .description("Get current positions")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--kind <kinds>", "filter by kind (comma-separated)")
    .option("--base <currencies>", "filter by base currency")
    .option("--quote <currencies>", "filter by quote currency")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const body: GetPositionsRequest = {
        sub_account_id: subAccountId,
        ...(opts["kind"] ? { kind: (opts["kind"] as string).split(",") as Kind[] } : {} as Record<string, never>),
        ...(opts["base"] ? { base: (opts["base"] as string).split(",") } : {} as Record<string, never>),
        ...(opts["quote"] ? { quote: (opts["quote"] as string).split(",") } : {} as Record<string, never>),
      };
      const result = await getPositions(ctx.client, body);
      output(result, ctx.outputOptions);
    }));
};
