export type Kind = "PERPETUAL" | "FUTURE" | "CALL" | "PUT";
export type Currency = string;
export type TimeInForce = "GOOD_TILL_TIME" | "IMMEDIATE_OR_CANCEL" | "ALL_OR_NONE" | "FILL_OR_KILL";
export type OrderSide = "BUY" | "SELL";

export interface OrderLeg {
  instrument: string;
  size: string;
  limit_price?: string;
  is_buying_asset: boolean;
}

export interface OrderMetadata {
  client_order_id: string;
  create_time?: string;
}

export interface OrderSignature {
  signer: string;
  r: string;
  s: string;
  v: number;
  expiration: string;
  nonce: number;
}

export interface SignedOrder {
  sub_account_id: string;
  is_market: boolean;
  time_in_force: TimeInForce;
  post_only: boolean;
  reduce_only: boolean;
  legs: OrderLeg[];
  signature: OrderSignature;
  metadata: OrderMetadata;
}

export interface CreateOrderRequest {
  order: SignedOrder;
}

export interface CancelOrderRequest {
  sub_account_id: string;
  order_id?: string;
  client_order_id?: string;
}

export interface CancelAllOrdersRequest {
  sub_account_id: string;
  instrument?: string;
}

export interface GetOrderRequest {
  sub_account_id: string;
  order_id?: string;
  client_order_id?: string;
}

export interface GetOpenOrdersRequest {
  sub_account_id: string;
  kind?: Kind[];
  base?: Currency[];
  quote?: Currency[];
}

export interface PaginatedRequest {
  sub_account_id: string;
  kind?: Kind[];
  base?: Currency[];
  quote?: Currency[];
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  result: T[];
  next?: string;
}

export interface GetPositionsRequest {
  sub_account_id: string;
  kind?: Kind[];
  base?: Currency[];
  quote?: Currency[];
}

export interface SubAccountSummaryRequest {
  sub_account_id: string;
}

export interface SubAccountHistoryRequest {
  sub_account_id: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface DepositRequest {
  main_account_id: string;
  to_sub_account_id: string;
  currency: string;
  num_tokens: string;
}

export interface TransferRequest {
  from_sub_account_id: string;
  to_sub_account_id: string;
  currency: string;
  num_tokens: string;
}

export interface WithdrawalRequest {
  main_account_id: string;
  from_sub_account_id: string;
  to_eth_address: string;
  currency: string;
  num_tokens: string;
}

export interface HistoryRequest {
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface InstrumentRequest {
  instrument: string;
}

export interface AllInstrumentsRequest {
  is_active?: boolean;
}

export interface FilteredInstrumentsRequest {
  kind?: Kind[];
  base?: Currency[];
  quote?: Currency[];
  is_active?: boolean;
  limit?: number;
}

export interface TickerRequest {
  instrument: string;
}

export interface OrderbookRequest {
  instrument: string;
  depth?: number;
}

export interface TradesRequest {
  instrument: string;
  limit?: number;
}

export interface TradeHistoryRequest {
  instrument: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface CandlestickRequest {
  instrument: string;
  interval: string;
  type: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface FundingRateRequest {
  instrument: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
  cursor?: string;
}

export interface AckResponse {
  result: { ack: boolean };
}

export interface ApiResponse<T = unknown> {
  result: T;
  next?: string;
}
