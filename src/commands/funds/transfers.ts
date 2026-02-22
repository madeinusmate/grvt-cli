import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output } from "../../core/command-helpers.js";
import { paginateCursor } from "../../core/pagination/cursor.js";
import { parseJsonInput, parseTimestamp, requireOption } from "../../core/safety/validate.js";
import { logInfo, printOutput } from "../../core/output/format.js";
import { confirm } from "../../core/safety/confirm.js";
import { exitAuth } from "../../core/output/errors.js";
import { buildTransferTypedData, generateNonce, generateExpiration } from "../../core/signing/eip712.js";
import { signTypedData, createSigner } from "../../core/signing/signer.js";
import { getCurrencyId, getCurrencyDecimals } from "../../core/currencies/cache.js";
import type { TransferRequest, HistoryRequest, ApiResponse } from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

export const createTransfer = async (
  client: HttpClient,
  params: TransferRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.funds.transfer, params);
  return result.result;
};

export const getTransferHistory = async (
  client: HttpClient,
  params: HistoryRequest,
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.funds.transferHistory, params);
};

export const registerTransferCommands = (parent: Command) => {
  const transferCmd = parent.command("transfer").description("Transfer management");

  transferCmd
    .command("create")
    .description("Transfer between sub-accounts")
    .requiredOption("--from-sub-account-id <id>", "source sub-account ID")
    .requiredOption("--to-sub-account-id <id>", "destination sub-account ID")
    .requiredOption("--currency <symbol>", "currency to transfer (e.g. USDT)")
    .requiredOption("--amount <amount>", "amount to transfer")
    .option("--json <path>", "read full request body from file (@path) or stdin (-)")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      let body: Record<string, unknown>;

      if (opts["json"]) {
        body = parseJsonInput(opts["json"] as string) as Record<string, unknown>;
      } else {
        if (!ctx.config.privateKey) {
          exitAuth("Private key required for transfer signing. Run `grvt config set privateKey <key>`.");
        }

        const fromSubAccountId = requireOption(opts["fromSubAccountId"], "from-sub-account-id");
        const toSubAccountId = requireOption(opts["toSubAccountId"], "to-sub-account-id");
        const currency = (opts["currency"] as string).toUpperCase();
        const amount = opts["amount"] as string;
        const fromAccount = ctx.config.accountId!;
        const toAccount = fromAccount;

        const signerAccount = createSigner(ctx.config.privateKey!);
        const tokenCurrency = await getCurrencyId(ctx.config.env, currency, ctx.config.cookie, ctx.config.accountId);
        const balanceDecimals = await getCurrencyDecimals(ctx.config.env, currency, ctx.config.cookie, ctx.config.accountId);

        const nonce = generateNonce();
        const expiration = generateExpiration(3600);

        const typedData = buildTransferTypedData({
          fromAccount: signerAccount.address,
          fromSubAccount: fromSubAccountId,
          toAccount: signerAccount.address,
          toSubAccount: toSubAccountId,
          tokenCurrency,
          numTokens: amount,
          balanceDecimals,
          expiration,
          nonce,
        }, ctx.config.env);

        const sigComponents = await signTypedData(ctx.config.privateKey!, typedData);

        body = {
          from_account_id: fromAccount,
          from_sub_account_id: fromSubAccountId,
          to_account_id: toAccount,
          to_sub_account_id: toSubAccountId,
          currency,
          num_tokens: amount,
          signature: {
            signer: sigComponents.signer,
            r: sigComponents.r,
            s: sigComponents.s,
            v: sigComponents.v,
            expiration,
            nonce,
          },
        };
      }

      if (opts["dryRun"]) {
        logInfo("Dry run - payload that would be sent:", Boolean(ctx.globalOpts["silent"]));
        printOutput(body, { ...ctx.outputOptions, output: "json", pretty: true });
        return;
      }

      const skipConfirm = Boolean(ctx.globalOpts["yes"]);
      const ok = await confirm(
        `Transfer ${body["num_tokens"]} ${body["currency"]} from ${body["from_sub_account_id"]} to ${body["to_sub_account_id"]}?`,
        skipConfirm,
      );
      if (!ok) {
        logInfo("Aborted.", Boolean(ctx.globalOpts["silent"]));
        return;
      }

      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.funds.transfer, body);
      output(result.result, ctx.outputOptions);
    }));

  transferCmd
    .command("history")
    .description("Get transfer history")
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
          const resp = await getTransferHistory(ctx.client, body);
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
