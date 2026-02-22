import { describe, it, expect, vi } from "vitest";
import { paginateCursor } from "../../src/core/pagination/cursor.js";
import type { OutputOptions } from "../../src/core/output/format.js";

const tableOpts: OutputOptions = { output: "table" };

describe("paginateCursor", () => {
  it("returns single page when all=false", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      result: [{ id: 1 }, { id: 2 }],
      next: "cursor2",
    });

    const results = await paginateCursor({
      fetchPage,
      all: false,
      outputOptions: tableOpts,
    });

    expect(results).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it("paginates through all pages when all=true", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ result: [{ id: 1 }], next: "cursor2" })
      .mockResolvedValueOnce({ result: [{ id: 2 }], next: "cursor3" })
      .mockResolvedValueOnce({ result: [{ id: 3 }], next: undefined });

    const results = await paginateCursor({
      fetchPage,
      all: true,
      outputOptions: tableOpts,
    });

    expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "cursor2");
    expect(fetchPage).toHaveBeenNthCalledWith(3, "cursor3");
  });

  it("stops when result is empty", async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ result: [{ id: 1 }], next: "cursor2" })
      .mockResolvedValueOnce({ result: [], next: "cursor3" });

    const results = await paginateCursor({
      fetchPage,
      all: true,
      outputOptions: tableOpts,
    });

    expect(results).toEqual([{ id: 1 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("passes initial cursor", async () => {
    const fetchPage = vi.fn().mockResolvedValue({
      result: [{ id: 5 }],
      next: undefined,
    });

    await paginateCursor({
      fetchPage,
      cursor: "start-here",
      all: false,
      outputOptions: tableOpts,
    });

    expect(fetchPage).toHaveBeenCalledWith("start-here");
  });

  it("streams ndjson output and returns empty array when all=true", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string) => {
      writes.push(chunk);
      return true;
    }) as typeof process.stdout.write;

    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ result: [{ id: 1 }], next: "c2" })
      .mockResolvedValueOnce({ result: [{ id: 2 }], next: undefined });

    const results = await paginateCursor({
      fetchPage,
      all: true,
      outputOptions: { output: "ndjson" },
    });

    process.stdout.write = originalWrite;

    expect(results).toEqual([]);
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[0]!.trim())).toEqual({ id: 1 });
    expect(JSON.parse(writes[1]!.trim())).toEqual({ id: 2 });
  });
});
