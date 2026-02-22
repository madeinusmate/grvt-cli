import Table from "cli-table3";
import { c } from "./colors.js";

export const renderTable = (data: Record<string, unknown>[]): string => {
  if (data.length === 0) return "No data";

  const keys = Object.keys(data[0]!);
  const table = new Table({
    head: keys.map((k) => c().cyan.bold(k)),
    style: { head: [], border: [] },
  });

  for (const row of data) {
    table.push(keys.map((k) => formatCell(row[k])));
  }

  return table.toString();
};

export const renderVerticalTable = (data: Record<string, unknown>): string => {
  const table = new Table({
    style: { head: [], border: [] },
  });

  for (const [key, value] of Object.entries(data)) {
    table.push({ [c().cyan.bold(key)]: formatCell(value) });
  }

  return table.toString();
};

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};
