import { createInterface } from "node:readline";
import { c } from "../output/colors.js";

export const confirm = async (message: string, skipConfirm?: boolean): Promise<boolean> => {
  if (skipConfirm) return true;

  const rl = createInterface({ input: process.stdin, output: process.stderr });

  return new Promise((resolve) => {
    rl.question(c().yellow(`${message} [y/N] `), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
};
