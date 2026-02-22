import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import { logInfo, printOutput } from "../../core/output/format.js";
import { exitAuth } from "../../core/output/errors.js";
import { buildDeriskTypedData, generateNonce, generateExpiration } from "../../core/signing/eip712.js";
import { signTypedData } from "../../core/signing/signer.js";
import type { ApiResponse } from "../../core/client/types.js";

export const registerDeriskCommands = (parent: Command) => {
  parent
    .command("derisk")
    .description("Set derisk-to-maintenance-margin ratio")
    .requiredOption("--ratio <value>", "derisk MM ratio (decimal, e.g. 0.5)")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      if (!ctx.config.privateKey) {
        exitAuth("Private key required for derisk signing. Run `grvt config set privateKey <key>`.");
      }

      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const ratio = opts["ratio"] as string;

      const nonce = generateNonce();
      const expiration = generateExpiration(3600);

      const typedData = buildDeriskTypedData({
        subAccountId,
        ratio,
        expiration,
        nonce,
      }, ctx.config.env);

      const sigComponents = await signTypedData(ctx.config.privateKey!, typedData);

      const body = {
        sub_account_id: subAccountId,
        ratio,
        signature: {
          signer: sigComponents.signer,
          r: sigComponents.r,
          s: sigComponents.s,
          v: sigComponents.v,
          expiration,
          nonce,
        },
      };

      if (opts["dryRun"]) {
        logInfo("Dry run - payload that would be sent:", Boolean(ctx.globalOpts["silent"]));
        printOutput(body, { ...ctx.outputOptions, output: "json", pretty: true });
        return;
      }

      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.trading.setDeriskMmRatio, body);
      output(result.result, ctx.outputOptions);
    }));
};
