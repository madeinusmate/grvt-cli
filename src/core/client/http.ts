import { type GrvtEnvironment, getBaseUrls } from "./endpoints.js";

export interface HttpClientOptions {
  env: GrvtEnvironment;
  cookie?: string;
  accountId?: string;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  maxBackoffMs?: number;
}

export interface HttpClient {
  post: <T>(baseType: "edge" | "marketData" | "trading", path: string, body?: unknown) => Promise<T>;
}

export const createHttpClient = (options: HttpClientOptions): HttpClient => {
  const {
    env,
    cookie,
    accountId,
    timeoutMs = 10000,
    retries = 3,
    backoffMs = 200,
    maxBackoffMs = 10000,
  } = options;

  const urls = getBaseUrls(env);

  const post = async <T>(baseType: "edge" | "marketData" | "trading", path: string, body?: unknown): Promise<T> => {
    const url = `${urls[baseType]}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cookie) {
      headers["Cookie"] = cookie;
    }
    if (accountId) {
      headers["X-Grvt-Account-Id"] = accountId;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status === 429 || response.status >= 500) {
          const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
          (err as HttpError).statusCode = response.status;
          throw err;
        }

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          const err = new Error(`HTTP ${response.status}: ${text || response.statusText}`);
          (err as HttpError).statusCode = response.status;
          throw err;
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable =
          (lastError as HttpError).statusCode === 429 ||
          ((lastError as HttpError).statusCode ?? 0) >= 500 ||
          lastError.name === "AbortError";

        if (!isRetryable || attempt >= retries) {
          throw lastError;
        }

        const delay = Math.min(backoffMs * Math.pow(2, attempt), maxBackoffMs);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error("Request failed");
  };

  return { post };
};

export interface HttpError extends Error {
  statusCode?: number;
}

export const extractAuthFromResponse = async (
  env: GrvtEnvironment,
  apiKey: string,
): Promise<{ cookie: string; accountId: string }> => {
  const urls = getBaseUrls(env);
  const url = `${urls.edge}/auth/api_key/login`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "rm=true;",
    },
    body: JSON.stringify({ api_key: apiKey }),
    redirect: "manual",
  });

  const bodyText = await response.text().catch(() => "");

  if (!response.ok && response.status !== 302) {
    throw new Error(`Auth failed (HTTP ${response.status}): ${bodyText || response.statusText}`);
  }

  // GRVT returns 200 with error body on auth failure
  if (bodyText) {
    try {
      const bodyJson = JSON.parse(bodyText) as Record<string, unknown>;
      if (bodyJson["status"] === "failure" || bodyJson["error"]) {
        throw new Error(`Auth failed: ${bodyJson["error"] ?? bodyJson["message"] ?? "unknown error"}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Auth failed")) throw e;
      // not JSON or no error field, continue
    }
  }

  // Extract cookie from set-cookie header
  const setCookies = response.headers.getSetCookie?.() ?? [];
  let gravityCookie = setCookies
    .map((c) => c.split(";")[0])
    .find((c) => c?.startsWith("gravity="));

  // Fallback: try the raw set-cookie header value
  if (!gravityCookie) {
    const rawSetCookie = response.headers.get("set-cookie");
    if (rawSetCookie) {
      const match = rawSetCookie.match(/gravity=[^;]+/);
      if (match) {
        gravityCookie = match[0];
      }
    }
  }

  if (!gravityCookie) {
    throw new Error("Auth response did not contain gravity session cookie. Verify your API key is valid.");
  }

  const accountId = response.headers.get("x-grvt-account-id");
  if (!accountId) {
    throw new Error("Auth response did not contain X-Grvt-Account-Id header");
  }

  return { cookie: gravityCookie, accountId: accountId.trim() };
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
