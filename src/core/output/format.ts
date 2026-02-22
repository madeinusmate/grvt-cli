import { renderTable, renderVerticalTable } from "./table.js";

export type OutputFormat = "json" | "ndjson" | "table" | "raw";

export interface OutputOptions {
  output: OutputFormat;
  pretty?: boolean;
  silent?: boolean;
}

export const resolveOutputOptions = (opts: Record<string, unknown>): OutputOptions => {
  const isTTY = process.stdout.isTTY ?? false;
  const format = (opts["output"] as OutputFormat) ?? (isTTY ? "table" : "json");
  return {
    output: format,
    pretty: Boolean(opts["pretty"]),
    silent: Boolean(opts["silent"]),
  };
};

export const formatOutput = (data: unknown, options: OutputOptions): string => {
  switch (options.output) {
    case "json":
      return options.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

    case "ndjson":
      if (Array.isArray(data)) {
        return data.map((item) => JSON.stringify(item)).join("\n");
      }
      return JSON.stringify(data);

    case "raw":
      if (typeof data === "string") return data;
      return JSON.stringify(data);

    case "table":
      if (Array.isArray(data)) {
        if (data.length === 0) return "No data";
        if (typeof data[0] === "object" && data[0] !== null) {
          return renderTable(data as Record<string, unknown>[]);
        }
        return data.map(String).join("\n");
      }
      if (typeof data === "object" && data !== null) {
        return renderVerticalTable(data as Record<string, unknown>);
      }
      return String(data);
  }
};

export const printOutput = (data: unknown, options: OutputOptions): void => {
  const formatted = formatOutput(data, options);
  process.stdout.write(formatted + "\n");
};

export const logInfo = (message: string, silent?: boolean): void => {
  if (!silent) {
    process.stderr.write(message + "\n");
  }
};
