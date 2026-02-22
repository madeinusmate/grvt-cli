import { describe, it, expect } from "vitest";
import { parseTimestamp } from "../../src/core/safety/validate.js";

describe("parseTimestamp", () => {
  it("converts seconds to nanoseconds", () => {
    const result = parseTimestamp("1700000000");
    expect(result).toBe("1700000000000000000");
  });

  it("converts milliseconds to nanoseconds", () => {
    const result = parseTimestamp("1700000000000");
    expect(result).toBe("1700000000000000000");
  });

  it("passes nanoseconds through", () => {
    const result = parseTimestamp("1700000000000000000");
    expect(result).toBe("1700000000000000000");
  });

  it("converts ISO date strings", () => {
    const result = parseTimestamp("2024-01-01T00:00:00Z");
    const expected = String(BigInt(new Date("2024-01-01T00:00:00Z").getTime()) * 1000000n);
    expect(result).toBe(expected);
  });
});
