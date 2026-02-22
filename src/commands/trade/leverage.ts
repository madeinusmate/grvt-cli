import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import type { ApiResponse } from "../../core/client/types.js";

export const registerLeverageCommands = (parent: Command) => {
  const leverageCmd = parent.command("leverage").description("Leverage settings");

  leverageCmd
    .command("get")
    .description("Get initial leverage settings for all instruments (or one)")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--instrument <name>", "filter by instrument (client-side)")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const body = { sub_account_id: subAccountId };
      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.trading.getAllInitialLeverage, body);
      const data = result.result as Record<string, unknown>[] | Record<string, unknown>;

      const instrument = opts["instrument"] as string | undefined;
      if (instrument && Array.isArray(data)) {
        const filtered = data.filter((entry) => (entry as Record<string, unknown>)["instrument"] === instrument);
        output(filtered.length === 1 ? filtered[0] : filtered, ctx.outputOptions);
      } else {
        output(data, ctx.outputOptions);
      }
    }));

  leverageCmd
    .command("set")
    .description("Set initial leverage for an instrument")
    .requiredOption("--instrument <name>", "instrument symbol")
    .requiredOption("--leverage <value>", "leverage value (e.g. 10)")
    .option("--sub-account-id <id>", "sub-account ID")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const body = {
        sub_account_id: subAccountId,
        instrument: opts["instrument"] as string,
        leverage: opts["leverage"] as string,
      };
      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.trading.setInitialLeverage, body);
      output(result.result, ctx.outputOptions);
    }));
};
