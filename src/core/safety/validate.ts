import { readFileSync, readSync } from "node:fs";
import { exitUsage } from "../output/errors.js";

export const requireOption = (value: unknown, name: string): string => {
  if (value === undefined || value === null || value === "") {
    return exitUsage(`--${name} is required`);
  }
  return String(value);
};

export const parseJsonInput = (jsonPath: string): unknown => {
  let raw: string;

  if (jsonPath === "-") {
    raw = readStdin();
  } else {
    const filePath = jsonPath.startsWith("@") ? jsonPath.slice(1) : jsonPath;
    try {
      raw = readFileSync(filePath, "utf-8");
    } catch (error) {
      return exitUsage(`Cannot read file: ${filePath} (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return exitUsage("Invalid JSON input");
  }
};

const readStdin = (): string => {
  const chunks: Buffer[] = [];
  const fd = 0;
  const buf = Buffer.alloc(4096);
  let bytesRead: number;

  try {
    while ((bytesRead = readSync(fd, buf, 0, buf.length, null)) > 0) {
      chunks.push(buf.subarray(0, bytesRead));
    }
  } catch {
    // EOF or broken pipe
  }

  return Buffer.concat(chunks).toString("utf-8");
};

export const parseTimestamp = (value: string): string => {
  const num = Number(value);
  if (!Number.isNaN(num)) {
    if (num < 1e12) {
      return String(BigInt(num) * 1000000000n);
    }
    if (num < 1e15) {
      return String(BigInt(num) * 1000000n);
    }
    return String(BigInt(num));
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return exitUsage(`Invalid timestamp: ${value}`);
  }
  return String(BigInt(date.getTime()) * 1000000n);
};
