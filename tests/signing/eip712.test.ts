import { describe, it, expect } from "vitest";
import { buildOrderTypedData, generateNonce, generateExpiration } from "../../src/core/signing/eip712.js";

describe("buildOrderTypedData", () => {
  it("constructs valid EIP-712 typed data for a limit order", () => {
    const result = buildOrderTypedData({
      subAccountId: "123456789",
      isMarket: false,
      timeInForce: "GOOD_TILL_TIME",
      postOnly: false,
      reduceOnly: false,
      legs: [{
        instrument: "BTC_USDT_Perp",
        size: "1.2",
        limit_price: "50000.5",
        is_buying_asset: true,
      }],
      instruments: {
        "BTC_USDT_Perp": { instrument_hash: "0x030501", base_decimals: 9 },
      },
      expiration: "1700000000000000000",
      nonce: 42,
    }, "testnet");

    expect(result.domain.name).toBe("GRVT Exchange");
    expect(result.domain.version).toBe("0");
    expect(result.domain.chainId).toBe(326n);
    expect(result.primaryType).toBe("Order");
    expect(result.types.Order).toBeDefined();
    expect(result.types.OrderLeg).toBeDefined();

    expect(result.message.subAccountID).toBe(123456789n);
    expect(result.message.isMarket).toBe(false);
    expect(result.message.timeInForce).toBe(1);
    expect(result.message.nonce).toBe(42);
    expect(result.message.legs).toHaveLength(1);
    expect(result.message.legs[0]!.contractSize).toBe(1200000000n);
    expect(result.message.legs[0]!.limitPrice).toBe(50000500000000n);
  });

  it("constructs valid data for a market order", () => {
    const result = buildOrderTypedData({
      subAccountId: "999",
      isMarket: true,
      timeInForce: "IMMEDIATE_OR_CANCEL",
      postOnly: false,
      reduceOnly: true,
      legs: [{
        instrument: "ETH_USDT_Perp",
        size: "50",
        is_buying_asset: false,
      }],
      instruments: {
        "ETH_USDT_Perp": { instrument_hash: "0x020501", base_decimals: 9 },
      },
      expiration: "1800000000000000000",
      nonce: 100,
    }, "prod");

    expect(result.domain.chainId).toBe(325n);
    expect(result.message.isMarket).toBe(true);
    expect(result.message.timeInForce).toBe(3);
    expect(result.message.reduceOnly).toBe(true);
    expect(result.message.legs[0]!.limitPrice).toBe(0n);
  });

  it("uses correct chain IDs per environment", () => {
    const dev = buildOrderTypedData(minimalPayload(), "dev");
    const staging = buildOrderTypedData(minimalPayload(), "staging");
    const testnet = buildOrderTypedData(minimalPayload(), "testnet");
    const prod = buildOrderTypedData(minimalPayload(), "prod");

    expect(dev.domain.chainId).toBe(327n);
    expect(staging.domain.chainId).toBe(327n);
    expect(testnet.domain.chainId).toBe(326n);
    expect(prod.domain.chainId).toBe(325n);
  });
});

describe("generateNonce", () => {
  it("returns a positive integer", () => {
    const nonce = generateNonce();
    expect(nonce).toBeGreaterThan(0);
    expect(Number.isInteger(nonce)).toBe(true);
  });

  it("returns different values on successive calls", () => {
    const nonces = new Set(Array.from({ length: 10 }, () => generateNonce()));
    expect(nonces.size).toBeGreaterThan(1);
  });
});

describe("generateExpiration", () => {
  it("returns a nanosecond timestamp string in the future", () => {
    const exp = generateExpiration(3600);
    const expNs = BigInt(exp);
    const nowNs = BigInt(Date.now()) * 1000000n;
    expect(expNs).toBeGreaterThan(nowNs);
  });

  it("defaults to 1 hour", () => {
    const exp = generateExpiration();
    const expMs = Number(BigInt(exp) / 1000000n);
    const expectedMs = Date.now() + 3600 * 1000;
    expect(Math.abs(expMs - expectedMs)).toBeLessThan(1000);
  });
});

const minimalPayload = () => ({
  subAccountId: "1",
  isMarket: false,
  timeInForce: "GOOD_TILL_TIME" as const,
  postOnly: false,
  reduceOnly: false,
  legs: [{ instrument: "BTC_USDT_Perp", size: "1", is_buying_asset: true }],
  instruments: {
    "BTC_USDT_Perp": { instrument_hash: "0x030501", base_decimals: 9 },
  },
  expiration: "1700000000000000000",
  nonce: 1,
});
