import { describe, it, expect } from "vitest";
import { normalizeError, EXIT_AUTH, EXIT_API } from "../../src/core/output/errors.js";
import type { HttpError } from "../../src/core/client/http.js";

describe("normalizeError", () => {
  it("returns EXIT_AUTH for 401 errors", () => {
    const err = new Error("Unauthorized") as HttpError;
    err.statusCode = 401;
    const result = normalizeError(err);
    expect(result.code).toBe(EXIT_AUTH);
    expect(result.message).toBe("Unauthorized");
  });

  it("returns EXIT_AUTH for 403 errors", () => {
    const err = new Error("Forbidden") as HttpError;
    err.statusCode = 403;
    const result = normalizeError(err);
    expect(result.code).toBe(EXIT_AUTH);
  });

  it("returns EXIT_API for other HTTP errors", () => {
    const err = new Error("Internal Server Error") as HttpError;
    err.statusCode = 500;
    const result = normalizeError(err);
    expect(result.code).toBe(EXIT_API);
  });

  it("returns EXIT_API for generic errors", () => {
    const err = new Error("Something broke");
    const result = normalizeError(err);
    expect(result.code).toBe(EXIT_API);
    expect(result.message).toBe("Something broke");
  });

  it("handles non-Error values", () => {
    expect(normalizeError("string error").message).toBe("string error");
    expect(normalizeError(42).message).toBe("42");
    expect(normalizeError(null).message).toBe("null");
  });
});
