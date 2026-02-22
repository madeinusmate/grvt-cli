# grvt-cli

CLI tool and library to trade on [GRVT](https://grvt.io) markets.

> **WARNING — READ BEFORE USING.**
>
> This is a **community hobby project**. It is **NOT** officially supported, endorsed, audited, or maintained by the GRVT team. No security audit or formal code review has been performed.
>
> **THIS SOFTWARE IS PROVIDED AS-IS WITH NO WARRANTY OF ANY KIND. THE CODE HAS NOT BEEN AUDITED FOR SECURITY VULNERABILITIES. BY USING THIS TOOL YOU ACKNOWLEDGE AND ACCEPT THE RISK OF TOTAL LOSS OF FUNDS.**
>
> You are solely responsible for any financial losses, leaked credentials, or unintended trades that may result from using this software. **Do NOT use this tool with funds you cannot afford to lose.**
>
> This tool stores your API key and private key in plaintext on disk (with `0600` file permissions). Never share your private key. Never run this on shared or untrusted machines.
>
> **Recommended baseline:**
> - Only use testnet until you fully understand the CLI.
> - Review the source code before trusting it with real funds.
> - Keep your private key out of shell history (use `grvt setup`).
> - Rotate API keys regularly.
> - Never run with more funds than you can afford to lose.

---

## Features

- Full trading lifecycle: create, cancel, and query orders
- Fund management: transfers, withdrawals, and deposit history
- Market data: instruments, tickers, orderbook, trades, candles, funding rates, margin rules, currency metadata
- Account summaries, history, and sub-account management
- Leverage get/set and derisk MM ratio management
- Cancel-on-disconnect for automated trading protection
- EIP-712 signing for orders, transfers, withdrawals, and derisk (Ethereum private key via viem)
- Cursor-based pagination with streaming `--all` support
- Multiple output formats: `json`, `ndjson`, `table`, `raw`
- Scriptable with consistent exit codes and `--silent` mode
- `--dry-run` on all write commands
- JSON file/stdin input for advanced payloads
- Library exports for programmatic use

## Requirements

- Node.js 20+

## Installation

```bash
pnpm add -g @madeinusmate/grvt-cli
# or
npm install -g @madeinusmate/grvt-cli
```

---

## Quick Start

The fastest way to get started is the interactive setup wizard:

```bash
grvt setup
```

This walks you through choosing an environment, entering your API key, private key, and default sub-account ID -- then logs you in automatically.

### Manual setup

If you prefer to configure things individually:

#### 1. Set your environment

```bash
grvt config set env testnet
```

Supported environments: `dev`, `staging`, `testnet`, `prod` (default: `prod`).

#### 2. Authenticate

```bash
grvt auth login --api-key YOUR_API_KEY --private-key 0xYOUR_PRIVATE_KEY
```

The private key is required for order signing (EIP-712). If you only need read access, you can omit it and add it later:

```bash
grvt auth login --api-key YOUR_API_KEY
grvt config set privateKey 0xYOUR_PRIVATE_KEY
```

Credentials are stored in `~/.config/grvt/config.toml` with `0600` permissions.

#### 3. Set your default sub-account

```bash
grvt config set subAccountId YOUR_SUB_ACCOUNT_ID
```

This saves you from passing `--sub-account-id` on every command.

### 4. Start trading

```bash
# List all active instruments
grvt market instruments

# Get BTC orderbook
grvt market orderbook --instrument BTC_USDT_Perp

# Place a limit buy order
grvt trade order create \
  --instrument BTC_USDT_Perp \
  --side buy \
  --type limit \
  --qty 0.01 \
  --price 68000

# View open orders
grvt trade order open

# Check positions
grvt trade positions

# View account summary
grvt account summary
```

---

## Global Options

These flags are available on every command:

| Flag | Description | Default |
|---|---|---|
| `--output <format>` | Output format: `json`, `ndjson`, `table`, `raw` | `table` (TTY) / `json` (piped) |
| `--pretty` | Pretty-print JSON output with indentation | `false` |
| `--silent` | Suppress info logs; only data goes to stdout | `false` |
| `--no-color` | Disable colored output | auto-detect |
| `--yes` | Skip all confirmation prompts | `false` |
| `--retries <n>` | Number of retries on network/server failure | `3` |
| `--timeout-ms <n>` | Request timeout in milliseconds | `10000` |

Write commands (`order create`, `order cancel`, `transfer create`, `withdraw create`) additionally support:

| Flag | Description |
|---|---|
| `--dry-run` | Validate and show the exact payload that would be sent, without sending |
| `--json <path>` | Read the full request body from a file (`@file.json`) or stdin (`-`) |

---

## Commands

### `grvt config` -- Configuration Management

Configuration is stored as TOML at `~/.config/grvt/config.toml` (or `$XDG_CONFIG_HOME/grvt/config.toml`).

#### `config path`

Print the absolute path to your config file.

```bash
grvt config path
# /Users/you/.config/grvt/config.toml
```

#### `config get [key]`

Get a single config value. Supports dot-notation for nested keys. Without a key, prints the full config (secrets redacted).

```bash
grvt config get env
# testnet

grvt config get http.timeoutMs
# 10000

grvt config get --output json
# {"env":"testnet","subAccountId":"12345",...}
```

#### `config set <key> <value>`

Set a config value. Validated against the config schema on save.

```bash
grvt config set env testnet
grvt config set subAccountId 924180738198039
grvt config set privateKey 0xabcdef...
grvt config set http.timeoutMs 15000
grvt config set outputDefaults.pretty true
```

**Available config keys:**

| Key | Type | Description |
|---|---|---|
| `env` | `dev\|staging\|testnet\|prod` | GRVT environment |
| `apiKey` | string | API key for authentication |
| `privateKey` | string | Ethereum private key for EIP-712 signing |
| `subAccountId` | string | Default sub-account ID |
| `accountId` | string | Main account ID (set automatically on login) |
| `cookie` | string | Session cookie (set automatically on login) |
| `outputDefaults.output` | `json\|ndjson\|table\|raw` | Default output format |
| `outputDefaults.pretty` | boolean | Default pretty-print JSON |
| `outputDefaults.silent` | boolean | Default silent mode |
| `http.timeoutMs` | number | HTTP request timeout (ms) |
| `http.retries` | number | Number of retries on failure |
| `http.backoffMs` | number | Initial retry backoff (ms) |
| `http.maxBackoffMs` | number | Maximum retry backoff (ms) |

#### `config unset <key>`

Remove a config value, resetting it to its default.

```bash
grvt config unset apiKey
```

#### `config list`

Print the full config with secret values redacted.

```bash
grvt config list --output json --pretty
```

#### `config export --file <path>`

Export the config to a file. By default secrets are redacted.

```bash
# Export without secrets
grvt config export --file backup.toml

# Export with secrets (prompts for confirmation)
grvt config export --file backup.toml --include-secrets --yes
```

#### `config import --file <path>`

Import config from a TOML file. Validates the file against the config schema.

```bash
grvt config import --file backup.toml
```

---

### `grvt auth` -- Authentication

GRVT uses API key authentication. Login creates a session cookie that is stored locally and sent with every authenticated request.

#### `auth login`

Authenticate with the GRVT API. Stores the session cookie, account ID, API key, and optionally the private key in config.

```bash
# Full login (API key + private key for order signing)
grvt auth login --api-key YOUR_API_KEY --private-key 0xYOUR_KEY

# Login with a specific environment
grvt auth login --api-key YOUR_API_KEY --env testnet

# API key can also come from config
grvt config set apiKey YOUR_API_KEY
grvt auth login
```

| Option | Description |
|---|---|
| `--api-key <key>` | GRVT API key (falls back to config `apiKey`) |
| `--private-key <key>` | Ethereum private key for EIP-712 signing (optional) |
| `--env <env>` | Environment override: `dev\|staging\|testnet\|prod` |

#### `auth status`

Check whether your current session is valid by making a test API call.

```bash
grvt auth status --output json
# {"valid":true,"env":"testnet","accountId":"0xabc..."}
```

#### `auth whoami`

Show your current authentication state without making API calls.

```bash
grvt auth whoami --output json --pretty
# {
#   "env": "testnet",
#   "accountId": "0xabc...",
#   "subAccountId": "924180738198039",
#   "hasApiKey": true,
#   "hasPrivateKey": true,
#   "hasSession": true
# }
```

#### `auth logout`

Clear all stored credentials (API key, private key, session cookie, account ID). Other settings like `env`, `subAccountId`, and `http` config are preserved.

```bash
grvt auth logout
```

---

### `grvt market` -- Market Data

Market data commands do **not** require authentication.

#### `market instruments`

List available trading instruments. Without filters, returns all active instruments.

```bash
# All active instruments
grvt market instruments

# Filter by kind
grvt market instruments --kind PERPETUAL

# Filter by base and quote currency
grvt market instruments --base BTC,ETH --quote USDT

# Combined filters with JSON output
grvt market instruments --kind PERPETUAL --base BTC --output json --pretty
```

| Option | Description |
|---|---|
| `--kind <kinds>` | Comma-separated: `PERPETUAL`, `FUTURE`, `CALL`, `PUT` |
| `--base <currencies>` | Comma-separated base currencies: `BTC`, `ETH`, etc. |
| `--quote <currencies>` | Comma-separated quote currencies: `USDT`, etc. |
| `--active` | Only active instruments (default: `true`) |
| `--limit <n>` | Maximum number of results |

#### `market orderbook`

Get the order book (bids and asks) for an instrument.

```bash
grvt market orderbook --instrument BTC_USDT_Perp
grvt market orderbook --instrument BTC_USDT_Perp --depth 50 --output json
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol (e.g. `BTC_USDT_Perp`) |
| `--depth <n>` | Number of levels: `10`, `50`, `100`, or `500` (default: `10`) |

#### `market trades`

Get recent trade history for an instrument. Supports pagination.

```bash
grvt market trades --instrument BTC_USDT_Perp --limit 10
grvt market trades --instrument ETH_USDT_Perp --start-time 2025-01-01T00:00:00Z --limit 50
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |
| `--start-time <time>` | Start time (see [Timestamp Formats](#timestamp-formats)) |
| `--end-time <time>` | End time |
| `--limit <n>` | Maximum trades per page |
| `--cursor <cursor>` | Pagination cursor from a previous response |
| `--all` | Auto-paginate through all results |

#### `market candles`

Get candlestick (OHLCV) data for an instrument. Supports pagination.

```bash
grvt market candles --instrument BTC_USDT_Perp --interval CI_1_H --limit 24
grvt market candles --instrument BTC_USDT_Perp --interval CI_1_D --type MARK
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |
| `--interval <interval>` | **Required.** Candle interval (see below) |
| `--type <type>` | Price type: `TRADE`, `MARK`, `INDEX`, `MID` (default: `TRADE`) |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Maximum candles per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

**Candle intervals:** `CI_1_M`, `CI_5_M`, `CI_15_M`, `CI_30_M`, `CI_1_H`, `CI_2_H`, `CI_4_H`, `CI_6_H`, `CI_8_H`, `CI_12_H`, `CI_1_D`, `CI_1_W`

#### `market funding-rate`

Get funding rate history for a perpetual instrument. Supports pagination.

```bash
grvt market funding-rate --instrument BTC_USDT_Perp --limit 10
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Maximum entries per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `market instrument`

Get full metadata for a single instrument by name.

```bash
grvt market instrument --instrument BTC_USDT_Perp --output json --pretty
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol (e.g. `BTC_USDT_Perp`) |

#### `market currency`

List all supported currencies with their IDs, symbols, and decimal precision.

```bash
grvt market currency --output json --pretty
```

No options required.

#### `market mini-ticker`

Get lightweight price data for an instrument: last price, mark price, index price, 24h change, open interest, and funding rate.

```bash
grvt market mini-ticker --instrument BTC_USDT_Perp --output json --pretty
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |

#### `market ticker`

Get full ticker data with 24h volume, bid/ask, and optionally greeks (for options) and derived statistics.

```bash
grvt market ticker --instrument BTC_USDT_Perp --output json --pretty
grvt market ticker --instrument BTC_USDT_Perp --greeks --derived
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |
| `--greeks` | Include greeks data (relevant for options) |
| `--derived` | Include derived statistics (24h volume, buy/sell ratio) |

#### `market margin-rules`

Get margin rules (initial margin, maintenance margin, risk bracket tiers) for an instrument.

```bash
grvt market margin-rules --instrument BTC_USDT_Perp --output json --pretty
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol (e.g. `BTC_USDT_Perp`) |

---

### `grvt account` -- Account Information

All account commands require authentication.

#### `account funding`

Get your funding (main) account summary -- balances and margin info.

```bash
grvt account funding --output json --pretty
```

#### `account summary`

Get a specific sub-account summary including balances, margin, and P&L.

```bash
grvt account summary
grvt account summary --sub-account-id 924180738198039 --output json
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config `subAccountId`) |

#### `account aggregated`

Get an aggregated summary across all your sub-accounts.

```bash
grvt account aggregated --output json --pretty
```

#### `account history`

Get hourly snapshots of sub-account state (balances, margin, P&L) over time. Supports pagination. History retained for 30 days.

```bash
grvt account history --limit 10
grvt account history --sub-account-id 924180738198039 --start-time 2025-01-01 --all
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config `subAccountId`) |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

---

### `grvt trade` -- Trading

All trade commands require authentication. Write commands (`order create`, `order cancel`, `order cancel-all`) also require a private key for EIP-712 signing.

#### `trade order create`

Create a new order. Requires a private key for EIP-712 signing.

```bash
# Limit buy order
grvt trade order create \
  --instrument BTC_USDT_Perp \
  --side buy \
  --type limit \
  --qty 0.01 \
  --price 68000

# Market sell order
grvt trade order create \
  --instrument BTC_USDT_Perp \
  --side sell \
  --type market \
  --qty 0.01 \
  --time-in-force IOC

# Post-only limit order
grvt trade order create \
  --instrument ETH_USDT_Perp \
  --side buy \
  --type limit \
  --qty 0.5 \
  --price 2500 \
  --post-only

# Reduce-only order (only decreases position)
grvt trade order create \
  --instrument BTC_USDT_Perp \
  --side sell \
  --type limit \
  --qty 0.01 \
  --price 100000 \
  --reduce-only

# Preview the exact API payload without sending
grvt trade order create \
  --instrument BTC_USDT_Perp \
  --side buy --type limit --qty 0.01 --price 68000 \
  --dry-run --output json --pretty

# From a JSON file
grvt trade order create --json @order.json
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol (e.g. `BTC_USDT_Perp`) |
| `--side <side>` | **Required.** `buy` or `sell` |
| `--type <type>` | **Required.** `limit` or `market` |
| `--qty <amount>` | **Required.** Order quantity in base asset (e.g. `0.01` = 0.01 BTC) |
| `--price <price>` | Limit price in quote asset. **Required for limit orders.** |
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--time-in-force <tif>` | `GTT`, `IOC`, `FOK`, or `AON` (default: `GTT`) |
| `--post-only` | Order must be a maker order or it's cancelled |
| `--reduce-only` | Order can only reduce an existing position |
| `--client-order-id <id>` | Custom numeric order ID (auto-generated if omitted) |
| `--expiration-seconds <n>` | Order expiration in seconds (default: `3600`) |
| `--json <path>` | Read full request body from file or stdin |
| `--dry-run` | Show payload without sending |

**Time-in-force values:**

| Value | Aliases | Description |
|---|---|---|
| `GOOD_TILL_TIME` | `GTT` | Order stays open until cancelled or expired |
| `IMMEDIATE_OR_CANCEL` | `IOC` | Fill as much as possible immediately, cancel the rest |
| `FILL_OR_KILL` | `FOK` | Fill the entire order immediately, or cancel it |
| `ALL_OR_NONE` | `AON` | Fill the entire order or not at all (block trades only) |

**How signing works:**

When you create an order, the CLI:

1. Fetches instrument metadata (cached for 1 hour) to get the `instrument_hash` and `base_decimals`
2. Builds an EIP-712 typed data structure with the order parameters
3. Signs it with your Ethereum private key using viem
4. Sends the order with a structured signature (`signer`, `r`, `s`, `v`, `expiration`, `nonce`) to the API

The `--dry-run` flag lets you inspect the exact payload before it hits the API.

#### `trade order get`

Look up a specific order by order ID or client order ID.

```bash
grvt trade order get --order-id 0xabc123...
grvt trade order get --client-order-id 18160428530557423435
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--order-id <id>` | GRVT-assigned order ID |
| `--client-order-id <id>` | Your client-specified order ID |

One of `--order-id` or `--client-order-id` is required.

#### `trade order open`

List all currently open orders.

```bash
grvt trade order open
grvt trade order open --kind PERPETUAL --base BTC --output json
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--kind <kinds>` | Comma-separated filter: `PERPETUAL`, `FUTURE`, `CALL`, `PUT` |
| `--base <currencies>` | Comma-separated base currency filter |
| `--quote <currencies>` | Comma-separated quote currency filter |

#### `trade order cancel`

Cancel a single order by its order ID or client order ID.

```bash
grvt trade order cancel --order-id 0xabc123...
grvt trade order cancel --client-order-id 18160428530557423435

# Preview what would be sent
grvt trade order cancel --order-id 0xabc123... --dry-run
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--order-id <id>` | GRVT-assigned order ID |
| `--client-order-id <id>` | Your client-specified order ID |
| `--dry-run` | Show payload without sending |

#### `trade order cancel-all`

Cancel all open orders. Prompts for confirmation unless `--yes` is passed.

```bash
grvt trade order cancel-all
grvt trade order cancel-all --instrument BTC_USDT_Perp --yes
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--instrument <name>` | Only cancel orders for this instrument |
| `--dry-run` | Show payload without sending |

#### `trade order history`

Get historical orders (filled, cancelled, rejected). Supports pagination.

```bash
grvt trade order history --limit 20
grvt trade order history --kind PERPETUAL --start-time 2025-01-01 --output ndjson
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--kind <kinds>` | Comma-separated filter |
| `--base <currencies>` | Base currency filter |
| `--quote <currencies>` | Quote currency filter |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `trade fills`

Get fill (trade execution) history. Supports pagination.

```bash
grvt trade fills --limit 10
grvt trade fills --kind PERPETUAL --base BTC --start-time 2025-01-01 --all
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--kind <kinds>` | Comma-separated filter |
| `--base <currencies>` | Base currency filter |
| `--quote <currencies>` | Quote currency filter |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `trade positions`

Get current open positions.

```bash
grvt trade positions
grvt trade positions --kind PERPETUAL --output json --pretty
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--kind <kinds>` | Comma-separated filter |
| `--base <currencies>` | Base currency filter |
| `--quote <currencies>` | Quote currency filter |

#### `trade funding-payments`

Get funding payment history. Supports pagination.

```bash
grvt trade funding-payments --limit 20
grvt trade funding-payments --start-time 2025-01-01 --all --output ndjson
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--kind <kinds>` | Comma-separated filter |
| `--base <currencies>` | Base currency filter |
| `--quote <currencies>` | Quote currency filter |
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `trade leverage get`

Get initial leverage settings for all instruments on a sub-account. Optionally filter to a single instrument.

```bash
grvt trade leverage get
grvt trade leverage get --instrument BTC_USDT_Perp --output json --pretty
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--instrument <name>` | Filter to a single instrument (client-side) |

#### `trade leverage set`

Set the initial leverage for a specific instrument on a sub-account.

```bash
grvt trade leverage set --instrument BTC_USDT_Perp --leverage 10
grvt trade leverage set --instrument ETH_USDT_Perp --leverage 5 --output json
```

| Option | Description |
|---|---|
| `--instrument <name>` | **Required.** Instrument symbol |
| `--leverage <value>` | **Required.** Leverage value (e.g. `10`) |
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |

#### `trade cancel-on-disconnect`

Set, refresh, or disable the cancel-on-disconnect countdown. When active, all open orders are automatically cancelled if no heartbeat is received within the countdown period. Used by market makers to protect against connection drops.

```bash
# Set countdown to 5 seconds
grvt trade cancel-on-disconnect --countdown 5000

# Disable cancel-on-disconnect
grvt trade cancel-on-disconnect --countdown 0
```

| Option | Description |
|---|---|
| `--countdown <ms>` | **Required.** Countdown in milliseconds (1000–300000, or `0` to disable) |
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |

#### `trade derisk`

Set the derisk-to-maintenance-margin ratio for a sub-account. Requires a private key for EIP-712 signing.

```bash
grvt trade derisk --ratio 0.5
grvt trade derisk --ratio 0.8 --dry-run --output json --pretty
```

| Option | Description |
|---|---|
| `--ratio <value>` | **Required.** Derisk MM ratio (decimal, e.g. `0.5`) |
| `--sub-account-id <id>` | Sub-account ID (falls back to config) |
| `--dry-run` | Show payload without sending |

---

### `grvt funds` -- Fund Management

All fund commands require authentication.

#### `funds deposit history`

Get deposit history. Supports pagination.

```bash
grvt funds deposit history --limit 10 --output json
```

Deposit creation is not available via REST API -- use the [GRVT web interface](https://grvt.io).

| Option | Description |
|---|---|
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `funds transfer create`

Transfer funds between sub-accounts. Requires a private key for EIP-712 signing. Prompts for confirmation.

```bash
grvt funds transfer create \
  --from-sub-account-id 111111 \
  --to-sub-account-id 222222 \
  --currency USDT \
  --amount 100

# Preview without sending
grvt funds transfer create \
  --from-sub-account-id 111111 \
  --to-sub-account-id 222222 \
  --currency USDT --amount 100 \
  --dry-run

# From JSON file
grvt funds transfer create --json @transfer.json
```

| Option | Description |
|---|---|
| `--from-sub-account-id <id>` | **Required.** Source sub-account ID |
| `--to-sub-account-id <id>` | **Required.** Destination sub-account ID |
| `--currency <symbol>` | **Required.** Currency symbol (e.g. `USDT`) |
| `--amount <amount>` | **Required.** Amount to transfer |
| `--json <path>` | Read request body from file or stdin |
| `--dry-run` | Show payload without sending |

#### `funds transfer history`

Get transfer history. Supports pagination.

```bash
grvt funds transfer history --limit 10
```

| Option | Description |
|---|---|
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

#### `funds withdraw create`

Withdraw funds from a sub-account to an Ethereum address. Requires a private key for EIP-712 signing. Prompts for confirmation.

```bash
grvt funds withdraw create \
  --to-address 0xYOUR_ETH_ADDRESS \
  --currency USDT \
  --amount 100

# With explicit sub-account
grvt funds withdraw create \
  --sub-account-id 111111 \
  --to-address 0xYOUR_ETH_ADDRESS \
  --currency USDT \
  --amount 50 \
  --dry-run
```

| Option | Description |
|---|---|
| `--sub-account-id <id>` | Source sub-account ID (falls back to config) |
| `--to-address <address>` | **Required.** Destination Ethereum address (`0x...`, 42 chars) |
| `--currency <symbol>` | **Required.** Currency symbol (e.g. `USDT`) |
| `--amount <amount>` | **Required.** Amount to withdraw |
| `--main-account-id <id>` | Main account ID (defaults to current account from login) |
| `--json <path>` | Read request body from file or stdin |
| `--dry-run` | Show payload without sending |

#### `funds withdraw history`

Get withdrawal history. Supports pagination.

```bash
grvt funds withdraw history --limit 10
```

| Option | Description |
|---|---|
| `--start-time <time>` | Start time |
| `--end-time <time>` | End time |
| `--limit <n>` | Max results per page |
| `--cursor <cursor>` | Pagination cursor |
| `--all` | Auto-paginate all results |

---

## Timestamp Formats

All `--start-time` and `--end-time` options accept these formats:

| Format | Example | Description |
|---|---|---|
| Unix seconds | `1704067200` | 10-digit integer |
| Unix milliseconds | `1704067200000` | 13-digit integer |
| Unix nanoseconds | `1704067200000000000` | 19-digit integer |
| ISO 8601 | `2025-01-01T00:00:00Z` | UTC datetime string |

All timestamps are converted to nanoseconds internally for the GRVT API.

---

## Pagination

Commands that return lists support cursor-based pagination:

```bash
# Get first page with a limit
grvt trade fills --limit 100

# Continue from a specific cursor (returned in previous response)
grvt trade fills --limit 100 --cursor "eyJhZnRlciI6..."

# Auto-paginate all results into a single array
grvt trade fills --all --output json

# Stream results as NDJSON (one JSON object per line, ideal for piping)
grvt trade fills --all --output ndjson | jq '.trade_id'

# Time-bounded paginated query
grvt trade fills --start-time 2025-01-01 --end-time 2025-02-01 --all
```

When using `--all` with `--output ndjson`, results stream as they are fetched (no buffering). With other output formats, all pages are collected before output.

---

## Output Formats

### `json` (default when piped)

Compact JSON on a single line. Add `--pretty` for indented output.

```bash
grvt trade positions --output json
# [{"instrument":"BTC_USDT_Perp","size":"0.01",...}]

grvt trade positions --output json --pretty
# [
#   {
#     "instrument": "BTC_USDT_Perp",
#     "size": "0.01",
#     ...
#   }
# ]
```

### `ndjson`

One JSON object per line. Best for streaming and piping to `jq`, `grep`, etc.

```bash
grvt trade fills --all --output ndjson | jq '.instrument'
```

### `table` (default in terminal)

Unicode box-drawing table with colored headers.

```bash
grvt trade positions
# ┌─────────────────┬──────┬──────────┐
# │ instrument      │ size │ ...      │
# ├─────────────────┼──────┼──────────┤
# │ BTC_USDT_Perp   │ 0.01 │ ...      │
# └─────────────────┴──────┴──────────┘
```

### `raw`

The raw JSON response from the GRVT API, without any transformation.

```bash
grvt account funding --output raw
```

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `2` | Usage / validation error (bad arguments, missing options) |
| `3` | Authentication / permission error |
| `4` | Partial failure (batch operations) |
| `5` | API / network error |

Use exit codes in scripts:

```bash
grvt auth status --silent && echo "Logged in" || echo "Not logged in"
```

---

## JSON Input

Write commands support reading the full request body from a file or stdin with `--json`:

```bash
# From a file
grvt trade order create --json @order.json

# From stdin
echo '{"order":{...}}' | grvt trade order create --json -

# Pipe from another command
cat order.json | grvt trade order create --json -
```

When `--json` is used, all other command-specific options (like `--instrument`, `--side`, etc.) are ignored -- the JSON payload is sent as-is.

---

## Configuration File

Full config file example (`~/.config/grvt/config.toml`):

```toml
env = "testnet"
apiKey = "your-api-key"
privateKey = "0xyour-private-key"
subAccountId = "924180738198039"

[outputDefaults]
output = "table"
pretty = false
silent = false

[http]
timeoutMs = 10000
retries = 3
backoffMs = 200
maxBackoffMs = 10000
```

The `apiKey`, `privateKey`, and `cookie` fields are stored with `0600` file permissions and redacted in `config list` output.

---

## Environments

| Environment | Market Data | Trading | Edge |
|---|---|---|---|
| `dev` | `market-data.dev.gravitymarkets.io` | `trades.dev.gravitymarkets.io` | `edge.dev.gravitymarkets.io` |
| `staging` | `market-data.staging.gravitymarkets.io` | `trades.staging.gravitymarkets.io` | `edge.staging.gravitymarkets.io` |
| `testnet` | `market-data.testnet.grvt.io` | `trades.testnet.grvt.io` | `edge.testnet.grvt.io` |
| `prod` | `market-data.grvt.io` | `trades.grvt.io` | `edge.grvt.io` |

---

## Library Usage

The package exports all core functions for programmatic use:

```typescript
import {
  loadConfig,
  createHttpClient,
  getOpenOrders,
  getPositions,
  getFundingAccountSummary,
  ENDPOINTS,
} from "grvt-cli";

const config = loadConfig();
const client = createHttpClient({
  env: config.env,
  cookie: config.cookie,
  accountId: config.accountId,
});

const positions = await getPositions(client, {
  sub_account_id: config.subAccountId!,
});

const orders = await getOpenOrders(client, {
  sub_account_id: config.subAccountId!,
  kind: ["PERPETUAL"],
});

const funding = await getFundingAccountSummary(client);
```

**Exported functions:**

| Module | Exports |
|---|---|
| Config | `loadConfig`, `saveConfig`, `configSchema`, `GrvtConfig` |
| Auth | `login`, `logout`, `verifySession` |
| Trading | `createOrder`, `cancelOrder`, `cancelAllOrders`, `getOrder`, `getOpenOrders`, `getOrderHistory` |
| Fills | `getFillHistory` |
| Positions | `getPositions` |
| Funding | `getFundingPayments` |
| Account | `getFundingAccountSummary`, `getSubAccountSummary`, `getAggregatedAccountSummary`, `getAccountHistory` |
| Funds | `createDeposit`, `getDepositHistory`, `createTransfer`, `getTransferHistory`, `createWithdrawal`, `getWithdrawalHistory` |
| Currencies | `getCurrencies`, `getCurrencyId`, `getCurrencyDecimals` |
| Signing | `buildTransferTypedData`, `buildWithdrawalTypedData`, `buildDeriskTypedData` |
| Client | `createHttpClient`, `ENDPOINTS`, `GrvtEnvironment` |
| Pagination | `paginateCursor` |

---

## Instrument Names

GRVT instruments follow this naming convention:

| Type | Format | Example |
|---|---|---|
| Perpetual | `{BASE}_{QUOTE}_Perp` | `BTC_USDT_Perp` |
| Future | `{BASE}_{QUOTE}_Fut_{DATE}` | `BTC_USDT_Fut_20Oct23` |
| Call | `{BASE}_{QUOTE}_Call_{DATE}_{STRIKE}` | `ETH_USDT_Call_20Oct23_2800` |
| Put | `{BASE}_{QUOTE}_Put_{DATE}_{STRIKE}` | `ETH_USDT_Put_20Oct23_2800` |

Use `grvt market instruments` to discover available instruments.

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests (requires testnet credentials)
pnpm test:e2e --api-key YOUR_KEY --private-key 0xYOUR_KEY --sub-account-id YOUR_ID
```

## Contributing

Contributions are welcome! This is a community project and every bit of help matters.

- **Report bugs** -- Open an [issue](../../issues) with steps to reproduce, the command you ran, and the error output.
- **Request features** -- Open an issue describing the use case and how you'd expect the command to work.
- **Submit PRs** -- Fork the repo, create a branch, make your changes, and open a pull request. Please include tests for new commands.

```bash
# Development workflow
pnpm install
pnpm dev          # watch mode (rebuilds on save)
pnpm test         # unit tests
pnpm lint         # type-check
pnpm test:e2e     # E2E tests (requires testnet credentials)
```

If you find a security issue, please open an issue or reach out directly rather than disclosing it publicly.

## License

MIT
