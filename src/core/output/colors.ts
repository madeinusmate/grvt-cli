import chalk from "chalk";

let _disabled = false;

export const disableColors = () => {
  _disabled = true;
};

export const c = () => {
  if (_disabled) {
    return {
      red: (s: string) => s,
      green: (s: string) => s,
      yellow: (s: string) => s,
      cyan: { bold: (s: string) => s },
    } as unknown as typeof chalk;
  }
  return chalk;
};
