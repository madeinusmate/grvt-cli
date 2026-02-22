import { describe, it, expect } from "vitest";
import { getBaseUrls, getChainIds, ENDPOINTS, type GrvtEnvironment } from "../../src/core/client/endpoints.js";

describe("getBaseUrls", () => {
  it("returns correct URLs for each environment", () => {
    const envs: GrvtEnvironment[] = ["dev", "staging", "testnet", "prod"];
    for (const env of envs) {
      const urls = getBaseUrls(env);
      expect(urls.edge).toContain("http");
      expect(urls.marketData).toContain("http");
      expect(urls.trading).toContain("http");
    }
  });

  it("uses grvt.io domain for prod", () => {
    const urls = getBaseUrls("prod");
    expect(urls.edge).toBe("https://edge.grvt.io");
    expect(urls.trading).toBe("https://trades.grvt.io");
  });

  it("uses gravitymarkets.io domain for dev", () => {
    const urls = getBaseUrls("dev");
    expect(urls.edge).toContain("gravitymarkets.io");
  });
});

describe("getChainIds", () => {
  it("returns correct L2 chain IDs", () => {
    expect(getChainIds("dev").l2).toBe(327);
    expect(getChainIds("staging").l2).toBe(327);
    expect(getChainIds("testnet").l2).toBe(326);
    expect(getChainIds("prod").l2).toBe(325);
  });

  it("returns correct L1 chain IDs", () => {
    expect(getChainIds("prod").l1).toBe(1);
    expect(getChainIds("testnet").l1).toBe(11155111);
  });
});

describe("ENDPOINTS", () => {
  it("has auth login path", () => {
    expect(ENDPOINTS.auth.login).toBe("/auth/api_key/login");
  });

  it("has all trading paths", () => {
    expect(ENDPOINTS.trading.createOrder).toContain("create_order");
    expect(ENDPOINTS.trading.cancelOrder).toContain("cancel_order");
    expect(ENDPOINTS.trading.cancelAllOrders).toContain("cancel_all_orders");
    expect(ENDPOINTS.trading.getOrder).toBe("/full/v1/order");
    expect(ENDPOINTS.trading.openOrders).toContain("open_orders");
    expect(ENDPOINTS.trading.orderHistory).toContain("order_history");
    expect(ENDPOINTS.trading.fillHistory).toContain("fill_history");
    expect(ENDPOINTS.trading.positions).toContain("positions");
  });

  it("has all fund management paths", () => {
    expect(ENDPOINTS.funds.transfer).toContain("transfer");
    expect(ENDPOINTS.funds.withdrawal).toContain("withdrawal");
    expect(ENDPOINTS.funds.depositHistory).toContain("deposit_history");
    expect(ENDPOINTS.funds.transferHistory).toContain("transfer_history");
    expect(ENDPOINTS.funds.withdrawalHistory).toContain("withdrawal_history");
  });

  it("has correct account paths", () => {
    expect(ENDPOINTS.account.accountSummary).toBe("/full/v1/account_summary");
    expect(ENDPOINTS.account.fundingAccountSummary).toContain("funding_account_summary");
    expect(ENDPOINTS.account.aggregatedAccountSummary).toContain("aggregated_account_summary");
  });
});
