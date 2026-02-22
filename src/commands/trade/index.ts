import { Command } from "commander";
import { registerOrderCommands } from "./orders.js";
import { registerFillCommands } from "./fills.js";
import { registerPositionCommands } from "./positions.js";
import { registerFundingPaymentCommands } from "./funding-payments.js";
import { registerLeverageCommands } from "./leverage.js";
import { registerCancelOnDisconnectCommands } from "./cancel-on-disconnect.js";
import { registerDeriskCommands } from "./derisk.js";

export const registerTradeCommands = (program: Command) => {
  const tradeCmd = program.command("trade").description("Trading: orders, fills, positions, funding, leverage, derisk");

  registerOrderCommands(tradeCmd);
  registerFillCommands(tradeCmd);
  registerPositionCommands(tradeCmd);
  registerFundingPaymentCommands(tradeCmd);
  registerLeverageCommands(tradeCmd);
  registerCancelOnDisconnectCommands(tradeCmd);
  registerDeriskCommands(tradeCmd);
};
