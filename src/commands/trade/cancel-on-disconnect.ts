import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import { exitUsage } from "../../core/output/errors.js";
import type { ApiResponse } from "../../core/client/types.js";

export const registerCancelOnDisconnectCommands = (parent: Command) => {
  parent
    .command("cancel-on-disconnect")
    .description("Set, refresh, or disable cancel-on-disconnect countdown (1000–300000ms, 0 to disable)")
    .requiredOption("--countdown <ms>", "countdown in milliseconds (0 to disable)")
    .option("--sub-account-id <id>", "sub-account ID")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const countdown = Number(opts["countdown"]);

      if (isNaN(countdown) || countdown < 0) {
        return exitUsage("--countdown must be a non-negative integer (ms)");
      }
      if (countdown !== 0 && (countdown < 1000 || countdown > 300000)) {
        return exitUsage("--countdown must be 0 (disable) or between 1000 and 300000 ms");
      }

      const body = {
        sub_account_id: subAccountId,
        countdown_time_ms: countdown,
      };

      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.trading.cancelOnDisconnect, body);
      output(result.result, ctx.outputOptions);
    }));
};
