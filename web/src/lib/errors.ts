import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/** Plain-language messages for StakeMarkets custom errors. */
const MESSAGES: Record<string, string> = {
  NotCreator: "This wallet is not an authorized market creator.",
  NotResolver: "This wallet is not an authorized resolver.",
  InvalidTimes: "Open/close times are outside the allowed range (1 minute to 30 days).",
  InvalidStakeLimits: "Minimum stake must be above zero and not exceed the maximum.",
  InvalidText: "A text field is empty or too long.",
  UnknownMarket: "That market does not exist.",
  MarketNotOpen: "This market is not accepting stakes right now.",
  InvalidSide: "Pick YES or NO.",
  SideLocked: "You already hold the other side of this market. One side per wallet.",
  StakeTooSmall: "Amount is below this market's minimum stake.",
  StakeTooLarge: "Amount would take your position above this market's maximum.",
  AlreadySettled: "This market is already settled.",
  MarketNotClosed: "This market has not closed yet.",
  NotSettled: "This market has not been settled yet.",
  NothingToClaim: "There is nothing to claim for this wallet.",
  AlreadyClaimed: "Already claimed.",
  NotAWinner: "This position did not win, so there is no payout.",
  TransferFailed: "The BOT transfer to your wallet failed.",
  EnforcedPause: "STAKE is temporarily paused for new activity. Claims remain open.",
};

export function describeError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "Transaction rejected in wallet.";
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    const name = revert?.data?.errorName;
    if (name && MESSAGES[name]) return MESSAGES[name];
    if (/insufficient funds/i.test(err.message)) return "Not enough BOT to cover the stake and gas.";
    return err.shortMessage || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
