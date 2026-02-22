import { c } from "./colors.js";
import type { HttpError } from "../client/http.js";

export const EXIT_SUCCESS = 0;
export const EXIT_USAGE = 2;
export const EXIT_AUTH = 3;
export const EXIT_PARTIAL = 4;
export const EXIT_API = 5;

export const exitWithError = (message: string, code: number = EXIT_API): never => {
  process.stderr.write(c().red(`Error: ${message}\n`));
  return process.exit(code) as never;
};

export const exitUsage = (message: string): never => exitWithError(message, EXIT_USAGE);
export const exitAuth = (message: string): never => exitWithError(message, EXIT_AUTH);

export const normalizeError = (error: unknown): { message: string; code: number } => {
  if (error instanceof Error) {
    const httpErr = error as HttpError;
    if (httpErr.statusCode === 401 || httpErr.statusCode === 403) {
      return { message: error.message, code: EXIT_AUTH };
    }
    if (httpErr.statusCode !== undefined) {
      return { message: error.message, code: EXIT_API };
    }
    return { message: error.message, code: EXIT_API };
  }
  return { message: String(error), code: EXIT_API };
};

export const handleCommandError = (error: unknown): never => {
  const { message, code } = normalizeError(error);
  return exitWithError(message, code);
};
