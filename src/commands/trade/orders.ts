import { Command } from "commander";
import { randomBytes } from "node:crypto";
import { ENDPOINTS } from "../../core/client/endpoints.js";
import { wrapAction, output, resolveSubAccountId } from "../../core/command-helpers.js";
import { paginateCursor } from "../../core/pagination/cursor.js";
import { confirm } from "../../core/safety/confirm.js";
import { parseJsonInput, parseTimestamp } from "../../core/safety/validate.js";
import { exitUsage, exitAuth } from "../../core/output/errors.js";
import { logInfo, printOutput } from "../../core/output/format.js";
import { getInstrument } from "../../core/instruments/cache.js";
import { buildOrderTypedData, generateNonce, generateExpiration } from "../../core/signing/eip712.js";
import { signTypedData } from "../../core/signing/signer.js";
import type {
  CreateOrderRequest,
  CancelOrderRequest,
  CancelAllOrdersRequest,
  GetOrderRequest,
  GetOpenOrdersRequest,
  PaginatedRequest,
  SignedOrder,
  OrderLeg,
  TimeInForce,
  Kind,
  ApiResponse,
} from "../../core/client/types.js";
import type { HttpClient } from "../../core/client/http.js";

// GRVT requires numeric client_order_id; client range is [2^63, 2^64-1]
const generateClientOrderId = (): string => {
  const min = 2n ** 63n;
  const range = 2n ** 63n;
  const rand = BigInt(`0x${randomBytes(8).toString("hex")}`) % range;
  return (min + rand).toString();
};

export const createOrder = async (
  client: HttpClient,
  order: SignedOrder,
): Promise<unknown> => {
  const body: CreateOrderRequest = { order };
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.createOrder, body);
  return result.result;
};

export const cancelOrder = async (
  client: HttpClient,
  params: CancelOrderRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.cancelOrder, params);
  return result.result;
};

export const cancelAllOrders = async (
  client: HttpClient,
  params: CancelAllOrdersRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.cancelAllOrders, params);
  return result.result;
};

export const getOrder = async (
  client: HttpClient,
  params: GetOrderRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.getOrder, params);
  return result.result;
};

export const getOpenOrders = async (
  client: HttpClient,
  params: GetOpenOrdersRequest,
): Promise<unknown> => {
  const result = await client.post<ApiResponse>("trading", ENDPOINTS.trading.openOrders, params);
  return result.result;
};

export const getOrderHistory = async (
  client: HttpClient,
  params: PaginatedRequest,
): Promise<ApiResponse<unknown[]>> => {
  return client.post<ApiResponse<unknown[]>>("trading", ENDPOINTS.trading.orderHistory, params);
};

export const registerOrderCommands = (parent: Command) => {
  const orderCmd = parent.command("order").description("Order lifecycle management");

  orderCmd
    .command("create")
    .description("Create a new order")
    .option("--sub-account-id <id>", "sub-account ID")
    .requiredOption("--instrument <name>", "instrument symbol")
    .requiredOption("--side <side>", "order side: buy|sell")
    .requiredOption("--type <type>", "order type: market|limit")
    .requiredOption("--qty <amount>", "order quantity")
    .option("--price <price>", "limit price (required for limit orders)")
    .option("--time-in-force <tif>", "GTT|IOC|AON|FOK", "GOOD_TILL_TIME")
    .option("--reduce-only", "reduce-only order")
    .option("--post-only", "post-only order")
    .option("--client-order-id <id>", "client order ID (auto-generated if not set)")
    .option("--expiration-seconds <n>", "order expiration in seconds", "3600")
    .option("--json <path>", "read full request body from file (@path) or stdin (-)")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      let orderPayload: Record<string, unknown>;

      if (opts["json"]) {
        orderPayload = parseJsonInput(opts["json"] as string) as Record<string, unknown>;
      } else {
        const subAccountId = resolveSubAccountId(opts, ctx.config);
        const instrument = opts["instrument"] as string;
        const side = (opts["side"] as string).toUpperCase();
        const type = (opts["type"] as string).toLowerCase();
        const qty = opts["qty"] as string;
        const price = opts["price"] as string | undefined;

        if (type === "limit" && !price) {
          exitUsage("--price is required for limit orders");
        }

        if (!ctx.config.privateKey) {
          exitAuth("Private key required for order signing. Run `grvt config set privateKey <key>` or `grvt auth login --private-key <key>`.");
        }

        const instrumentMeta = await getInstrument(ctx.config.env, instrument, ctx.config.cookie, ctx.config.accountId);

        const isMarket = type === "market";

        const leg: OrderLeg = {
          instrument,
          size: qty,
          limit_price: isMarket ? "0" : (price ?? "0"),
          is_buying_asset: side === "BUY",
        };

        const tifMap: Record<string, TimeInForce> = {
          GTT: "GOOD_TILL_TIME",
          IOC: "IMMEDIATE_OR_CANCEL",
          AON: "ALL_OR_NONE",
          FOK: "FILL_OR_KILL",
          GOOD_TILL_TIME: "GOOD_TILL_TIME",
          IMMEDIATE_OR_CANCEL: "IMMEDIATE_OR_CANCEL",
          ALL_OR_NONE: "ALL_OR_NONE",
          FILL_OR_KILL: "FILL_OR_KILL",
        };

        const tifInput = (opts["timeInForce"] as string) ?? "GOOD_TILL_TIME";
        const timeInForce = tifMap[tifInput.toUpperCase()];
        if (!timeInForce) {
          return exitUsage(`Invalid time-in-force: ${tifInput}. Use GTT, IOC, AON, or FOK.`);
        }

        const nonce = generateNonce();
        const expiration = generateExpiration(Number(opts["expirationSeconds"] ?? 3600));
        const clientOrderId = (opts["clientOrderId"] as string) ?? generateClientOrderId();

        const typedData = buildOrderTypedData({
          subAccountId,
          isMarket,
          timeInForce,
          postOnly: Boolean(opts["postOnly"]),
          reduceOnly: Boolean(opts["reduceOnly"]),
          legs: [leg],
          instruments: {
            [instrument]: {
              instrument_hash: instrumentMeta.instrument_hash as string,
              base_decimals: (instrumentMeta.base_decimals as number) ?? 9,
            },
          },
          expiration,
          nonce,
        }, ctx.config.env);

        const sigComponents = await signTypedData(ctx.config.privateKey!, typedData);

        orderPayload = {
          order: {
            sub_account_id: subAccountId,
            is_market: isMarket,
            time_in_force: timeInForce,
            post_only: Boolean(opts["postOnly"]),
            reduce_only: Boolean(opts["reduceOnly"]),
            legs: [leg],
            signature: {
              signer: sigComponents.signer,
              r: sigComponents.r,
              s: sigComponents.s,
              v: sigComponents.v,
              expiration,
              nonce,
            },
            metadata: { client_order_id: clientOrderId },
          },
        };
      }

      if (opts["dryRun"]) {
        logInfo("Dry run - payload that would be sent:", Boolean(ctx.globalOpts["silent"]));
        printOutput(orderPayload, { ...ctx.outputOptions, output: "json", pretty: true });
        return;
      }

      const result = await ctx.client.post<ApiResponse>("trading", ENDPOINTS.trading.createOrder, orderPayload);
      output(result.result, ctx.outputOptions);
    }));

  orderCmd
    .command("get")
    .description("Get an order by ID")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--order-id <id>", "order ID")
    .option("--client-order-id <id>", "client order ID")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      if (!opts["orderId"] && !opts["clientOrderId"]) {
        exitUsage("Either --order-id or --client-order-id is required");
      }
      const body: GetOrderRequest = {
        sub_account_id: subAccountId,
        ...(opts["orderId"] ? { order_id: opts["orderId"] as string } : {} as Record<string, never>),
        ...(opts["clientOrderId"] ? { client_order_id: opts["clientOrderId"] as string } : {} as Record<string, never>),
      };
      const result = await getOrder(ctx.client, body);
      output(result, ctx.outputOptions);
    }));

  orderCmd
    .command("open")
    .description("List open orders")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--kind <kinds>", "filter by kind (comma-separated)")
    .option("--base <currencies>", "filter by base currency")
    .option("--quote <currencies>", "filter by quote currency")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const body: GetOpenOrdersRequest = {
        sub_account_id: subAccountId,
        ...(opts["kind"] ? { kind: (opts["kind"] as string).split(",") as Kind[] } : {} as Record<string, never>),
        ...(opts["base"] ? { base: (opts["base"] as string).split(",") } : {} as Record<string, never>),
        ...(opts["quote"] ? { quote: (opts["quote"] as string).split(",") } : {} as Record<string, never>),
      };
      const result = await getOpenOrders(ctx.client, body);
      output(result, ctx.outputOptions);
    }));

  orderCmd
    .command("cancel")
    .description("Cancel a single order")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--order-id <id>", "order ID")
    .option("--client-order-id <id>", "client order ID")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      if (!opts["orderId"] && !opts["clientOrderId"]) {
        exitUsage("Either --order-id or --client-order-id is required");
      }
      const body: CancelOrderRequest = {
        sub_account_id: subAccountId,
        ...(opts["orderId"] ? { order_id: opts["orderId"] as string } : {} as Record<string, never>),
        ...(opts["clientOrderId"] ? { client_order_id: opts["clientOrderId"] as string } : {} as Record<string, never>),
      };

      if (opts["dryRun"]) {
        logInfo("Dry run - payload that would be sent:", Boolean(ctx.globalOpts["silent"]));
        printOutput(body, { ...ctx.outputOptions, output: "json", pretty: true });
        return;
      }

      const result = await cancelOrder(ctx.client, body);
      output(result, ctx.outputOptions);
    }));

  orderCmd
    .command("cancel-all")
    .description("Cancel all open orders")
    .option("--sub-account-id <id>", "sub-account ID")
    .option("--instrument <name>", "filter by instrument")
    .option("--dry-run", "validate and show payload without sending")
    .action(wrapAction(true, async (ctx, opts) => {
      const subAccountId = resolveSubAccountId(opts, ctx.config);
      const body: CancelAllOrdersRequest = {
        sub_account_id: subAccountId,
        ...(opts["instrument"] ? { instrument: opts["instrument"] as string } : {} as Record<string, never>),
      };

      if (opts["dryRun"]) {
        logInfo("Dry run - payload that would be sent:", Boolean(ctx.globalOpts["silent"]));
        printOutput(body, { ...ctx.outputOptions, output: "json", pretty: true });
        return;
      }

      const skipConfirm = Boolean(ctx.globalOpts["yes"]);
      const ok = await confirm("Cancel ALL open orders?", skipConfirm);
      if (!ok) {
        logInfo("Aborted.", Boolean(ctx.globalOpts["silent"]));
        return;
      }

      const result = await cancelAllOrders(ctx.client, body);
      output(result, ctx.outputOptions);
    }));

  orderCmd
    .command("history")
    .description("Get order history")
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
          const resp = await getOrderHistory(ctx.client, body);
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
