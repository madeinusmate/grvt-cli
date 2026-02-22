import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLI = resolve(import.meta.dirname, "../../dist/cli.js");
const INSTRUMENT = "BTC_USDT_Perp";

interface TestResult {
  name: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

const run = (
  name: string,
  args: string,
  opts: { expectExit?: number; expectStdout?: string | RegExp; skipIf?: boolean } = {},
): TestResult | null => {
  if (opts.skipIf) {
    skipCount++;
    log(`  SKIP  ${name}`);
    return null;
  }

  const expectedExit = opts.expectExit ?? 0;
  const start = Date.now();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  try {
    const execOpts: ExecSyncOptionsWithStringEncoding = {
      encoding: "utf-8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    };
    stdout = execSync(`node ${CLI} ${args}`, execOpts);
    stderr = "";
  } catch (error: unknown) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    exitCode = e.status ?? 1;
    stdout = e.stdout ?? "";
    stderr = e.stderr ?? "";
  }

  const durationMs = Date.now() - start;
  let passed = exitCode === expectedExit;

  if (passed && opts.expectStdout) {
    if (typeof opts.expectStdout === "string") {
      passed = stdout.includes(opts.expectStdout);
    } else {
      passed = opts.expectStdout.test(stdout);
    }
  }

  const result: TestResult = { name, passed, exitCode, stdout, stderr, durationMs };
  results.push(result);

  if (passed) {
    passCount++;
    log(`  PASS  ${name} (${durationMs}ms)`);
  } else {
    failCount++;
    log(`  FAIL  ${name} (${durationMs}ms)`);
    log(`         exit=${exitCode} (expected ${expectedExit})`);
    if (stderr) log(`         stderr: ${stderr.trim().slice(0, 200)}`);
    if (opts.expectStdout) log(`         stdout: ${stdout.trim().slice(0, 200)}`);
  }

  return result;
};

const log = (msg: string) => process.stderr.write(msg + "\n");

const parseJson = (stdout: string): unknown => {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = () => {
  const args = process.argv.slice(2);
  const apiKey = args.find((a) => a.startsWith("--api-key="))?.split("=")[1]
    ?? args[args.indexOf("--api-key") + 1];
  const privateKey = args.find((a) => a.startsWith("--private-key="))?.split("=")[1]
    ?? args[args.indexOf("--private-key") + 1];
  const subAccountId = args.find((a) => a.startsWith("--sub-account-id="))?.split("=")[1]
    ?? args[args.indexOf("--sub-account-id") + 1];

  if (!apiKey || !privateKey || !subAccountId) {
    log("Usage: npx tsx tests/e2e/run.ts --api-key <KEY> --private-key <KEY> --sub-account-id <ID>");
    log("");
    log("All three arguments are required for the full test suite.");
    process.exit(2);
  }

  log("=".repeat(70));
  log("grvt-cli E2E Test Suite (testnet)");
  log("=".repeat(70));
  log("");

  // =========================================================================
  // 1. CONFIG COMMANDS
  // =========================================================================
  log("--- Config Commands ---");

  run("config path", "config path", {
    expectStdout: "config.toml",
  });

  run("config set env", "config set env testnet");

  run("config set subAccountId", `config set subAccountId ${subAccountId}`);

  run("config get env", "config get env --output json", {
    expectStdout: "testnet",
  });

  run("config get subAccountId", "config get subAccountId --output json", {
    expectStdout: subAccountId,
  });

  run("config list", "config list --output json", {
    expectStdout: "testnet",
  });

  run("config set http.timeoutMs", "config set http.timeoutMs 15000");

  run("config get http.timeoutMs", "config get http.timeoutMs --output json", {
    expectStdout: "15000",
  });

  // Reset timeout
  run("config reset http.timeoutMs", "config set http.timeoutMs 10000");

  run("config unset", "config unset cookie");

  log("");

  // =========================================================================
  // 2. AUTH COMMANDS
  // =========================================================================
  log("--- Auth Commands ---");

  run("auth whoami (pre-login)", "auth whoami --output json", {
    expectStdout: "hasSession",
  });

  run("auth login", `auth login --api-key ${apiKey} --private-key ${privateKey} --env testnet`);

  const statusResult = run("auth status", "auth status --output json");
  const statusJson = statusResult ? parseJson(statusResult.stdout) : null;
  const isLoggedIn = statusJson && typeof statusJson === "object" && (statusJson as Record<string, unknown>)["valid"] === true;

  run("auth whoami (post-login)", "auth whoami --output json", {
    expectStdout: "true",
  });

  log("");

  // =========================================================================
  // 3. MARKET DATA COMMANDS (no auth required)
  // =========================================================================
  log("--- Market Data Commands ---");

  run("market instruments (all)", "market instruments --output json --pretty", {
    expectStdout: "instrument",
  });

  run("market instruments (filtered)", "market instruments --kind PERPETUAL --output json", {
    expectStdout: "PERPETUAL",
  });

  run("market instruments (base filter)", "market instruments --base BTC --output json", {
    expectStdout: "BTC",
  });

  run("market orderbook", `market orderbook --instrument ${INSTRUMENT} --depth 10 --output json`, {
    expectStdout: "bids",
  });

  run("market trades", `market trades --instrument ${INSTRUMENT} --limit 5 --output json`, {
    expectStdout: "trade_id",
  });

  run("market candles", `market candles --instrument ${INSTRUMENT} --interval CI_1_H --type TRADE --limit 3 --output json`, {
    expectStdout: "open",
  });

  run("market funding-rate", `market funding-rate --instrument ${INSTRUMENT} --limit 3 --output json`, {
    expectStdout: "funding_rate",
  });

  // Table output mode
  run("market orderbook (table)", `market orderbook --instrument ${INSTRUMENT} --depth 10 --output table`, {
    expectStdout: "price",
  });

  // NDJSON output mode
  run("market trades (ndjson)", `market trades --instrument ${INSTRUMENT} --limit 2 --output ndjson`, {
    expectStdout: "trade_id",
  });

  // New market data commands
  run("market instrument (single)", `market instrument --instrument ${INSTRUMENT} --output json`, {
    expectStdout: "instrument",
  });

  run("market currency (all)", "market currency --output json", {
    expectStdout: /symbol|currency/i,
  });

  run("market mini-ticker", `market mini-ticker --instrument ${INSTRUMENT} --output json`, {
    expectStdout: /last|mark|price/i,
  });

  run("market ticker", `market ticker --instrument ${INSTRUMENT} --output json`, {
    expectStdout: /last|mark|price/i,
  });

  run("market ticker (with greeks)", `market ticker --instrument ${INSTRUMENT} --greeks --output json`, {
    expectStdout: /last|mark|price/i,
  });

  run("market margin-rules", `market margin-rules --instrument ${INSTRUMENT} --output json`, {
    expectStdout: /margin|tier|leverage/i,
  });

  log("");

  // =========================================================================
  // 4. ACCOUNT COMMANDS (auth required)
  // =========================================================================
  log("--- Account Commands ---");

  run("account summary", `account summary --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
    expectStdout: /sub_account_id|error/,
  });

  run("account funding", "account funding --output json", {
    skipIf: !isLoggedIn,
  });

  run("account aggregated", "account aggregated --output json", {
    skipIf: !isLoggedIn,
  });

  run("account history", `account history --sub-account-id ${subAccountId} --limit 3 --output json`, {
    skipIf: !isLoggedIn,
  });

  log("");

  // =========================================================================
  // 5. TRADE COMMANDS - READ ONLY (auth required)
  // =========================================================================
  log("--- Trade Commands (read-only) ---");

  run("trade order open", `trade order open --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade order open (filtered)", `trade order open --sub-account-id ${subAccountId} --kind PERPETUAL --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade order history", `trade order history --sub-account-id ${subAccountId} --limit 5 --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade fills", `trade fills --sub-account-id ${subAccountId} --limit 5 --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade fills (with filters)", `trade fills --sub-account-id ${subAccountId} --kind PERPETUAL --limit 3 --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade positions", `trade positions --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade positions (filtered)", `trade positions --sub-account-id ${subAccountId} --kind PERPETUAL --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade funding-payments", `trade funding-payments --sub-account-id ${subAccountId} --limit 5 --output json`, {
    skipIf: !isLoggedIn,
  });

  // Leverage commands
  run("trade leverage get", `trade leverage get --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade leverage get (filtered)", `trade leverage get --sub-account-id ${subAccountId} --instrument ${INSTRUMENT} --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade leverage set", `trade leverage set --sub-account-id ${subAccountId} --instrument ${INSTRUMENT} --leverage 5 --output json`, {
    skipIf: !isLoggedIn,
  });

  // Cancel on disconnect
  run("trade cancel-on-disconnect (set)", `trade cancel-on-disconnect --countdown 5000 --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
  });

  run("trade cancel-on-disconnect (disable)", `trade cancel-on-disconnect --countdown 0 --sub-account-id ${subAccountId} --output json`, {
    skipIf: !isLoggedIn,
  });

  // Derisk (dry-run)
  run("trade derisk set (dry-run)", [
    "trade derisk",
    `--sub-account-id ${subAccountId}`,
    "--ratio 0.5 --dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "signature",
  });

  log("");

  // =========================================================================
  // 6. TRADE COMMANDS - WRITE (dry-run only)
  // =========================================================================
  log("--- Trade Commands (dry-run writes) ---");

  run("order create (limit, dry-run)", [
    "trade order create",
    `--instrument ${INSTRUMENT}`,
    "--side buy --type limit --qty 0.001 --price 10000",
    "--dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "signature",
  });

  run("order create (market, dry-run)", [
    "trade order create",
    `--instrument ${INSTRUMENT}`,
    "--side sell --type market --qty 0.001",
    "--time-in-force IOC --dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "is_market",
  });

  run("order create (post-only, dry-run)", [
    "trade order create",
    `--instrument ${INSTRUMENT}`,
    "--side buy --type limit --qty 0.001 --price 10000",
    "--post-only --dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: '"post_only": true',
  });

  run("order create (reduce-only, dry-run)", [
    "trade order create",
    `--instrument ${INSTRUMENT}`,
    "--side sell --type limit --qty 0.001 --price 100000",
    "--reduce-only --dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: '"reduce_only": true',
  });

  run("order cancel (dry-run)", [
    "trade order cancel",
    `--sub-account-id ${subAccountId}`,
    "--order-id test-order-123",
    "--dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "test-order-123",
  });

  run("order cancel-all (dry-run)", [
    "trade order cancel-all",
    `--sub-account-id ${subAccountId}`,
    "--dry-run --output json --yes",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: subAccountId,
  });

  log("");

  // =========================================================================
  // 7. TRADE COMMANDS - LIVE ORDER LIFECYCLE
  // =========================================================================
  log("--- Trade Commands (live order lifecycle) ---");

  // Place a limit buy far below market so it won't fill
  const liveOrderResult = run("order create (live, far-from-market)", [
    "trade order create",
    `--instrument ${INSTRUMENT}`,
    "--side buy --type limit --qty 0.01 --price 68000",
    "--output json --pretty",
  ].join(" "), {
    skipIf: !isLoggedIn,
  });

  let clientOrderId: string | undefined;
  if (liveOrderResult?.passed && liveOrderResult.stdout) {
    const parsed = parseJson(liveOrderResult.stdout) as Record<string, unknown> | null;
    const metadata = (parsed?.["metadata"] ?? (parsed?.["result"] as Record<string, unknown> | undefined)?.["metadata"]) as Record<string, unknown> | undefined;
    clientOrderId = metadata?.["client_order_id"] as string | undefined;
    if (clientOrderId) {
      log(`         Created order (client_order_id): ${clientOrderId}`);
    }
  }

  if (clientOrderId) {
    run("order get (by client order id)", [
      "trade order get",
      `--sub-account-id ${subAccountId}`,
      `--client-order-id ${clientOrderId}`,
      "--output json",
    ].join(" "), {
      skipIf: !isLoggedIn,
    });

    run("order cancel (live)", [
      "trade order cancel",
      `--sub-account-id ${subAccountId}`,
      `--client-order-id ${clientOrderId}`,
      "--output json",
    ].join(" "), {
      skipIf: !isLoggedIn,
    });
  } else {
    skipCount += 2;
    log("  SKIP  order get (by client order id) - no client_order_id from create");
    log("  SKIP  order cancel (live) - no client_order_id from create");
  }

  log("");

  // =========================================================================
  // 8. FUNDS COMMANDS (auth required)
  // =========================================================================
  log("--- Funds Commands ---");

  run("deposit history", "funds deposit history --limit 5 --output json", {
    skipIf: !isLoggedIn,
  });

  run("transfer history", "funds transfer history --limit 5 --output json", {
    skipIf: !isLoggedIn,
  });

  run("withdrawal history", "funds withdraw history --limit 5 --output json", {
    skipIf: !isLoggedIn,
  });

  // Dry-run only for write operations (now includes EIP-712 signatures)
  run("transfer create (dry-run)", [
    "funds transfer create",
    `--from-sub-account-id ${subAccountId}`,
    `--to-sub-account-id ${subAccountId}`,
    "--currency USDT --amount 1",
    "--dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "signature",
  });

  run("withdraw create (dry-run)", [
    "funds withdraw create",
    `--sub-account-id ${subAccountId}`,
    "--to-address 0x0000000000000000000000000000000000000001",
    "--currency USDT --amount 1",
    "--dry-run --output json",
  ].join(" "), {
    skipIf: !isLoggedIn,
    expectStdout: "signature",
  });

  log("");

  // =========================================================================
  // 9. OUTPUT FORMAT TESTS
  // =========================================================================
  log("--- Output Format Tests ---");

  run("json output", `market funding-rate --instrument ${INSTRUMENT} --limit 1 --output json`, {
    expectStdout: /^\[/,
  });

  run("json pretty output", `market funding-rate --instrument ${INSTRUMENT} --limit 1 --output json --pretty`, {
    expectStdout: /\n\s+"/,
  });

  run("ndjson output", `market trades --instrument ${INSTRUMENT} --limit 2 --output ndjson`, {
    expectStdout: /\n.*trade_id/,
  });

  run("raw output", `market funding-rate --instrument ${INSTRUMENT} --limit 1 --output raw`, {
    expectStdout: "funding_rate",
  });

  log("");

  // =========================================================================
  // 10. ERROR HANDLING TESTS
  // =========================================================================
  log("--- Error Handling Tests ---");

  run("missing required option", "trade order create --side buy", {
    expectExit: 1, // commander exits with 1 for missing required
  });

  run("invalid instrument", `market orderbook --instrument FAKE_FAKE_FAKE --output json`, {
    expectExit: 5,
  });

  run("config set invalid env", "config set env invalid", {
    expectExit: 5,
  });

  run("order create no private key", [
    "trade order create",
    "--instrument BTC_USDT_Perp --side buy --type limit --qty 0.01 --price 50000",
    "--dry-run --output json",
  ].join(" "), {
    // This might pass since we set privateKey during login, or fail if config
    // doesn't have it. Either way, it should not crash.
  });

  log("");

  // =========================================================================
  // 11. AUTH LOGOUT
  // =========================================================================
  log("--- Cleanup ---");

  run("auth logout", "auth logout");

  run("auth status (post-logout)", "auth status --output json", {
    expectStdout: "false",
  });

  // Re-login to restore state for user
  run("auth re-login", `auth login --api-key ${apiKey} --private-key ${privateKey} --env testnet`);

  log("");

  // =========================================================================
  // SUMMARY
  // =========================================================================
  log("=".repeat(70));
  log(`Results: ${passCount} passed, ${failCount} failed, ${skipCount} skipped (${results.length} total)`);
  log("=".repeat(70));

  if (failCount > 0) {
    log("");
    log("Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      log(`  - ${r.name} (exit=${r.exitCode})`);
      if (r.stderr) log(`    ${r.stderr.trim().slice(0, 150)}`);
    }
  }

  log("");
  process.exit(failCount > 0 ? 1 : 0);
};

main();
