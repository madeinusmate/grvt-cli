import type { GrvtEnvironment } from "../client/endpoints.js";
import { getChainIds } from "../client/endpoints.js";
import type { OrderLeg, TimeInForce } from "../client/types.js";

export interface InstrumentMeta {
  instrument_hash: string;
  base_decimals: number;
}

export interface OrderPayload {
  subAccountId: string;
  isMarket: boolean;
  timeInForce: TimeInForce;
  postOnly: boolean;
  reduceOnly: boolean;
  legs: OrderLeg[];
  instruments: Record<string, InstrumentMeta>;
  expiration: string;
  nonce: number;
}

const PRICE_MULTIPLIER = 1_000_000_000n;

const TIME_IN_FORCE_MAP: Record<TimeInForce, number> = {
  GOOD_TILL_TIME: 1,
  ALL_OR_NONE: 2,
  IMMEDIATE_OR_CANCEL: 3,
  FILL_OR_KILL: 4,
};

const decimalToBigInt = (value: string, multiplier: bigint): bigint => {
  const parts = value.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const multiplierDigits = multiplier.toString().length - 1;
  const paddedFrac = frac.padEnd(multiplierDigits, "0").slice(0, multiplierDigits);
  return BigInt(whole) * multiplier + BigInt(paddedFrac);
};

export const buildOrderTypedData = (payload: OrderPayload, env: GrvtEnvironment) => {
  const chainIds = getChainIds(env);

  const domain = {
    name: "GRVT Exchange",
    version: "0",
    chainId: BigInt(chainIds.l2),
  } as const;

  const types = {
    Order: [
      { name: "subAccountID", type: "uint64" },
      { name: "isMarket", type: "bool" },
      { name: "timeInForce", type: "uint8" },
      { name: "postOnly", type: "bool" },
      { name: "reduceOnly", type: "bool" },
      { name: "legs", type: "OrderLeg[]" },
      { name: "nonce", type: "uint32" },
      { name: "expiration", type: "int64" },
    ],
    OrderLeg: [
      { name: "assetID", type: "uint256" },
      { name: "contractSize", type: "uint64" },
      { name: "limitPrice", type: "uint64" },
      { name: "isBuyingContract", type: "bool" },
    ],
  } as const;

  const legs = payload.legs.map((leg) => {
    const meta = payload.instruments[leg.instrument];
    if (!meta) {
      throw new Error(`Instrument metadata not found for: ${leg.instrument}`);
    }
    const sizeMultiplier = BigInt(10) ** BigInt(meta.base_decimals);
    return {
      assetID: BigInt(meta.instrument_hash),
      contractSize: decimalToBigInt(leg.size, sizeMultiplier),
      limitPrice: decimalToBigInt(leg.limit_price ?? "0", PRICE_MULTIPLIER),
      isBuyingContract: leg.is_buying_asset,
    };
  });

  const message = {
    subAccountID: BigInt(payload.subAccountId),
    isMarket: payload.isMarket,
    timeInForce: TIME_IN_FORCE_MAP[payload.timeInForce],
    postOnly: payload.postOnly,
    reduceOnly: payload.reduceOnly,
    legs,
    nonce: payload.nonce,
    expiration: BigInt(payload.expiration),
  };

  return { domain, types, primaryType: "Order" as const, message };
};

// ---- Transfer EIP-712 ----

export interface TransferPayload {
  fromAccount: string;
  fromSubAccount: string;
  toAccount: string;
  toSubAccount: string;
  tokenCurrency: number;
  numTokens: string;
  balanceDecimals: number;
  expiration: string;
  nonce: number;
}

export const buildTransferTypedData = (payload: TransferPayload, env: GrvtEnvironment) => {
  const chainIds = getChainIds(env);

  const domain = {
    name: "GRVT Exchange",
    version: "0",
    chainId: BigInt(chainIds.l2),
  } as const;

  const types = {
    Transfer: [
      { name: "fromAccount", type: "address" },
      { name: "fromSubAccount", type: "uint64" },
      { name: "toAccount", type: "address" },
      { name: "toSubAccount", type: "uint64" },
      { name: "tokenCurrency", type: "uint8" },
      { name: "numTokens", type: "uint64" },
      { name: "nonce", type: "uint32" },
      { name: "expiration", type: "int64" },
    ],
  } as const;

  const tokenMultiplier = BigInt(10) ** BigInt(payload.balanceDecimals);

  const message = {
    fromAccount: payload.fromAccount as `0x${string}`,
    fromSubAccount: BigInt(payload.fromSubAccount),
    toAccount: payload.toAccount as `0x${string}`,
    toSubAccount: BigInt(payload.toSubAccount),
    tokenCurrency: payload.tokenCurrency,
    numTokens: decimalToBigInt(payload.numTokens, tokenMultiplier),
    nonce: payload.nonce,
    expiration: BigInt(payload.expiration),
  };

  return { domain, types, primaryType: "Transfer" as const, message };
};

// ---- Withdrawal EIP-712 ----

export interface WithdrawalPayload {
  fromAccount: string;
  toEthAddress: string;
  tokenCurrency: number;
  numTokens: string;
  balanceDecimals: number;
  expiration: string;
  nonce: number;
}

export const buildWithdrawalTypedData = (payload: WithdrawalPayload, env: GrvtEnvironment) => {
  const chainIds = getChainIds(env);

  const domain = {
    name: "GRVT Exchange",
    version: "0",
    chainId: BigInt(chainIds.l2),
  } as const;

  const types = {
    Withdrawal: [
      { name: "fromAccount", type: "address" },
      { name: "toEthAddress", type: "address" },
      { name: "tokenCurrency", type: "uint8" },
      { name: "numTokens", type: "uint64" },
      { name: "nonce", type: "uint32" },
      { name: "expiration", type: "int64" },
    ],
  } as const;

  const tokenMultiplier = BigInt(10) ** BigInt(payload.balanceDecimals);

  const message = {
    fromAccount: payload.fromAccount as `0x${string}`,
    toEthAddress: payload.toEthAddress as `0x${string}`,
    tokenCurrency: payload.tokenCurrency,
    numTokens: decimalToBigInt(payload.numTokens, tokenMultiplier),
    nonce: payload.nonce,
    expiration: BigInt(payload.expiration),
  };

  return { domain, types, primaryType: "Withdrawal" as const, message };
};

// ---- Derisk EIP-712 ----

export interface DeriskPayload {
  subAccountId: string;
  ratio: string;
  expiration: string;
  nonce: number;
}

export const buildDeriskTypedData = (payload: DeriskPayload, env: GrvtEnvironment) => {
  const chainIds = getChainIds(env);

  const domain = {
    name: "GRVT Exchange",
    version: "0",
    chainId: BigInt(chainIds.l2),
  } as const;

  const types = {
    SetDeriskMMRatio: [
      { name: "subAccountID", type: "uint64" },
      { name: "ratio", type: "uint64" },
      { name: "nonce", type: "uint32" },
      { name: "expiration", type: "int64" },
    ],
  } as const;

  const message = {
    subAccountID: BigInt(payload.subAccountId),
    ratio: decimalToBigInt(payload.ratio, PRICE_MULTIPLIER),
    nonce: payload.nonce,
    expiration: BigInt(payload.expiration),
  };

  return { domain, types, primaryType: "SetDeriskMMRatio" as const, message };
};

// ---- Shared utilities ----

export const generateNonce = (): number =>
  Math.floor(Math.random() * 2147483647);

export const generateExpiration = (durationSeconds: number = 3600): string => {
  const expirationMs = Date.now() + durationSeconds * 1000;
  return String(BigInt(expirationMs) * 1000000n);
};
