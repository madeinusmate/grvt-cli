import { Command } from "commander";
import { registerDepositCommands } from "./deposits.js";
import { registerTransferCommands } from "./transfers.js";
import { registerWithdrawalCommands } from "./withdrawals.js";

export const registerFundsCommands = (program: Command) => {
  const fundsCmd = program.command("funds").description("Fund management: deposits, transfers, withdrawals");

  registerDepositCommands(fundsCmd);
  registerTransferCommands(fundsCmd);
  registerWithdrawalCommands(fundsCmd);
};
