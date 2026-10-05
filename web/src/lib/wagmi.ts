import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { activeChain, rpcUrl } from "./chains";

/**
 * Browser wallets only. EIP-6963 discovery (on by default) lists each injected wallet with its
 * own name and icon, which the wallet menu shows.
 */
export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: { [activeChain.id]: http(rpcUrl, { batch: false }) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
