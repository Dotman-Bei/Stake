import { createConfig, http } from "wagmi";
import type { Chain } from "viem";
import { injected } from "@wagmi/core";
import { activeChain, rpcUrl } from "./chains";

/**
 * Browser wallets only. EIP-6963 discovery (on by default) lists each injected wallet with its
 * own name and icon, which the wallet menu shows.
 */
const chain: Chain = activeChain;

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [injected()],
  transports: { [chain.id]: http(rpcUrl, { batch: false }) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
