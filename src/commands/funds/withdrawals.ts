import { Command } from "commander";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output } from "../../core/command-helpers.js";
import { paginateCursor } from "../../core/pagination/cursor.js";
import { parseJsonInput, parseTimestamp, requireOption } from "../../core/safety/validate.js";
import { logInfo, printOutput } from "../../core/output/format.js";
import { confirm } from "../../core/safety/confirm.js";
import { exitUsage, exitAuth } from "../../core/output/errors.js";
import { buildWithdrawalTypedData, generateNonce, generateExpiration } from "../../core/signing/eip712.js";
import { signTypedData, createSigner } from "../../core/signing/signer.js";
import { getCurrencyId, getCurrencyDecimals } from "../../core/currencies/cache.js";
import type { WithdrawalRequest, HistoryRequest, ApiResponse } from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

export const createWithdrawal = async (
  client: HttpClient,
  params: WithdrawalRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.funds.withdrawal, params);
  return result.result;
};

export const getWithdrawalHistory = async (
  client: HttpClient,
  params: HistoryRequest,
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.funds.withdrawalHistory, params);
};

export const registerWithdrawalCommands = (parent: Command) => {
  const withdrawCmd = parent.command("withdraw").description("Withdrawal management");

  withdrawCmd
    .command("create")
    .description("Withdraw from sub-account to Ethereum address")
    .option("--sub-account-id <id>", "source sub-account ID")
    .requiredOption("--to-address <address>", "destination Ethereum address")
    .requiredOption("--currency <symbol>", "currency to withdraw (e.g. USDT)")
    .requiredOption("--amount <amount>", "amount to withdraw")
    .option("--main-account-id <id>", "main account ID (defaults to current account)")
    .option("--json <path>", "read full request body from file (@path) or stdin (-)")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      let body: Record<string, unknown>;

      if (opts["json"]) {
        body = parseJsonInput(opts["json"] as string) as Record<string, unknown>;
      } else {
        if (!ctx.config.privateKey) {
          exitAuth("Private key required for withdrawal signing. Run `grvt config set privateKey <key>`.");
        }

        const toAddress = opts["toAddress"] as string;
        if (!toAddress.startsWith("0x") || toAddress.length !== 42) {
          exitUsage("--to-address must be a valid Ethereum address (0x...)");
        }

        const subAccountId = opts["subAccountId"] as string ?? ctx.config.subAccountId;
        if (!subAccountId) {
          exitUsage("--sub-account-id is required (or set subAccountId in config)");
        }

        const mainAccountId = (opts["mainAccountId"] as string) ?? requireOption(ctx.config.accountId, "main-account-id");
        const currency = (opts["currency"] as string).toUpperCase();
        const amount = opts["amount"] as string;

        const signerAccount = createSigner(ctx.config.privateKey!);
        const tokenCurrency = await getCurrencyId(ctx.config.env, currency, ctx.config.cookie, ctx.config.accountId);
        const balanceDecimals = await getCurrencyDecimals(ctx.config.env, currency, ctx.config.cookie, ctx.config.accountId);

        const nonce = generateNonce();
        const expiration = generateExpiration(3600);

        const typedData = buildWithdrawalTypedData({
          fromAccount: signerAccount.address,
          toEthAddress: toAddress,
          tokenCurrency,
          numTokens: amount,
          balanceDecimals,
          expiration,
          nonce,
        }, ctx.config.env);

        const sigComponents = await signTypedData(ctx.config.privateKey!, typedData);

        body = {
          main_account_id: mainAccountId,
          from_sub_account_id: subAccountId,
          to_eth_address: toAddress,
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
        `Withdraw ${body["num_tokens"]} ${body["currency"]} to ${body["to_eth_address"]}?`,
        skipConfirm,
      );
      if (!ok) {
        logInfo("Aborted.", Boolean(ctx.globalOpts["silent"]));
        return;
      }

      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.funds.withdrawal, body);
      output(result.result, ctx.outputOptions);
    }));

  withdrawCmd
    .command("history")
    .description("Get withdrawal history")
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
          const resp = await getWithdrawalHistory(ctx.client, body);
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
