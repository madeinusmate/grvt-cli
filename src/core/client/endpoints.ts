export type GrvtEnvironment = "dev" | "staging" | "testnet" | "prod";

const BASE_URLS: Record<GrvtEnvironment, { edge: string; marketData: string; trading: string }> = {
  dev: {
    edge: "https://edge.dev.gravitymarkets.io",
    marketData: "https://market-data.dev.gravitymarkets.io",
    trading: "https://trades.dev.gravitymarkets.io",
  },
  staging: {
    edge: "https://edge.staging.gravitymarkets.io",
    marketData: "https://market-data.staging.gravitymarkets.io",
    trading: "https://trades.staging.gravitymarkets.io",
  },
  testnet: {
    edge: "https://edge.testnet.grvt.io",
    marketData: "https://market-data.testnet.grvt.io",
    trading: "https://trades.testnet.grvt.io",
  },
  prod: {
    edge: "https://edge.grvt.io",
    marketData: "https://market-data.grvt.io",
    trading: "https://trades.grvt.io",
  },
};

export const CHAIN_IDS: Record<GrvtEnvironment, { l1: number; l2: number }> = {
  dev: { l1: 11155111, l2: 327 },
  staging: { l1: 11155111, l2: 327 },
  testnet: { l1: 11155111, l2: 326 },
  prod: { l1: 1, l2: 325 },
};

export const ENDPOINTS = {
  auth: {
    login: "/auth/api_key/login",
  },

  marketData: {
    instrument: "/full/v1/instrument",
    allInstruments: "/full/v1/all_instruments",
    instruments: "/full/v1/instruments",
    currency: "/full/v1/currency",
    marginRules: "/full/v1/margin_rules",
    mini: "/full/v1/mini",
    ticker: "/full/v1/ticker",
    tradeHistory: "/full/v1/trade_history",
    kline: "/full/v1/kline",
    funding: "/full/v1/funding",
    book: "/full/v1/book",
  },

  trading: {
    createOrder: "/full/v1/create_order",
    cancelOrder: "/full/v1/cancel_order",
    cancelAllOrders: "/full/v1/cancel_all_orders",
    getOrder: "/full/v1/order",
    openOrders: "/full/v1/open_orders",
    orderHistory: "/full/v1/order_history",
    cancelOnDisconnect: "/full/v1/cancel_on_disconnect",
    fillHistory: "/full/v1/fill_history",
    positions: "/full/v1/positions",
    fundingPaymentHistory: "/full/v1/funding_payment_history",
    getAllInitialLeverage: "/full/v1/get_all_initial_leverage",
    setInitialLeverage: "/full/v1/set_initial_leverage",
    setDeriskMmRatio: "/full/v1/set_derisk_mm_ratio",
  },

  account: {
    accountSummary: "/full/v1/account_summary",
    accountHistory: "/full/v1/account_history",
    fundingAccountSummary: "/full/v1/funding_account_summary",
    aggregatedAccountSummary: "/full/v1/aggregated_account_summary",
  },

  funds: {
    depositHistory: "/full/v1/deposit_history",
    transfer: "/full/v1/transfer",
    transferHistory: "/full/v1/transfer_history",
    withdrawal: "/full/v1/withdrawal",
    withdrawalHistory: "/full/v1/withdrawal_history",
  },
} as const;

export const getBaseUrls = (env: GrvtEnvironment) => BASE_URLS[env];
export const getChainIds = (env: GrvtEnvironment) => CHAIN_IDS[env];
