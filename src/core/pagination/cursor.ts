import type { OutputOptions } from "../output/format.js";
import { formatOutput } from "../output/format.js";

export interface PaginateOptions<T> {
  fetchPage: (cursor?: string) => Promise<{ result: T[]; next?: string }>;
  limit?: number;
  cursor?: string;
  all?: boolean;
  outputOptions: OutputOptions;
}

export const paginateCursor = async <T>(options: PaginateOptions<T>): Promise<T[]> => {
  const { fetchPage, all, outputOptions } = options;
  let { cursor } = options;

  if (!all) {
    const page = await fetchPage(cursor);
    return page.result;
  }

  const isStreaming = outputOptions.output === "ndjson";
  const collected: T[] = [];

  while (true) {
    const page = await fetchPage(cursor);

    if (isStreaming) {
      for (const item of page.result) {
        process.stdout.write(formatOutput(item, outputOptions) + "\n");
      }
    } else {
      collected.push(...page.result);
    }

    if (!page.next || page.result.length === 0) {
      break;
    }

    cursor = page.next;
  }

  return collected;
};
