import { describe, it, expect } from "vitest";
import { formatOutput, type OutputOptions } from "../../src/core/output/format.js";

describe("formatOutput", () => {
  const jsonOpts: OutputOptions = { output: "json" };
  const prettyJsonOpts: OutputOptions = { output: "json", pretty: true };
  const ndjsonOpts: OutputOptions = { output: "ndjson" };
  const rawOpts: OutputOptions = { output: "raw" };
  const tableOpts: OutputOptions = { output: "table" };

  describe("json format", () => {
    it("formats object as JSON", () => {
      const result = formatOutput({ a: 1, b: "two" }, jsonOpts);
      expect(JSON.parse(result)).toEqual({ a: 1, b: "two" });
    });

    it("formats array as JSON", () => {
      const result = formatOutput([1, 2, 3], jsonOpts);
      expect(JSON.parse(result)).toEqual([1, 2, 3]);
    });

    it("pretty prints when option set", () => {
      const result = formatOutput({ a: 1 }, prettyJsonOpts);
      expect(result).toContain("\n");
      expect(result).toContain("  ");
    });

    it("compact by default", () => {
      const result = formatOutput({ a: 1 }, jsonOpts);
      expect(result).not.toContain("\n");
    });
  });

  describe("ndjson format", () => {
    it("formats array as newline-delimited JSON", () => {
      const result = formatOutput([{ a: 1 }, { b: 2 }], ndjsonOpts);
      const lines = result.split("\n");
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!)).toEqual({ a: 1 });
      expect(JSON.parse(lines[1]!)).toEqual({ b: 2 });
    });

    it("formats single object as one line", () => {
      const result = formatOutput({ a: 1 }, ndjsonOpts);
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });
  });

  describe("raw format", () => {
    it("passes strings through", () => {
      expect(formatOutput("hello", rawOpts)).toBe("hello");
    });

    it("JSON-stringifies objects", () => {
      const result = formatOutput({ a: 1 }, rawOpts);
      expect(JSON.parse(result)).toEqual({ a: 1 });
    });
  });

  describe("table format", () => {
    it("renders array of objects as table", () => {
      const result = formatOutput([{ name: "BTC", price: 50000 }], tableOpts);
      expect(result).toContain("name");
      expect(result).toContain("BTC");
      expect(result).toContain("50000");
    });

    it("renders single object as vertical table", () => {
      const result = formatOutput({ name: "BTC", price: 50000 }, tableOpts);
      expect(result).toContain("name");
      expect(result).toContain("BTC");
    });

    it("returns 'No data' for empty array", () => {
      expect(formatOutput([], tableOpts)).toBe("No data");
    });

    it("renders primitive values as strings", () => {
      expect(formatOutput("hello", tableOpts)).toBe("hello");
      expect(formatOutput(42, tableOpts)).toBe("42");
    });
  });
});
