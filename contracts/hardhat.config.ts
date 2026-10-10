import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "./tasks/markets";

/**
 * BOT Chain network values.
 *
 * Verified 2026-10-05 against the official developer docs
 * (https://dev-docs.botchain.ai/docs/Developers/quick-guide/), the Chainlist entry
 * (https://chainlist.org/chain/677) and live `eth_chainId` calls.
 * Every value can be overridden from `.env`, so re-verify before each deployment
 * instead of trusting these defaults (PRD §19).
 */
const env = process.env;
const accounts = env.DEPLOYER_PRIVATE_KEY ? [env.DEPLOYER_PRIVATE_KEY] : [];

const BOT_TESTNET = {
  chainId: Number(env.BOT_TESTNET_CHAIN_ID ?? 968),
  rpc: env.BOT_TESTNET_RPC ?? "https://rpc.bohr.life",
  explorer: env.BOT_TESTNET_EXPLORER ?? "https://scan.bohr.life",
};

const BOT_MAINNET = {
  chainId: Number(env.BOT_MAINNET_CHAIN_ID ?? 677),
  rpc: env.BOT_MAINNET_RPC ?? "https://rpc.botchain.ai",
  explorer: env.BOT_MAINNET_EXPLORER ?? "https://scan.botchain.ai",
};

/**
 * Fixed gas price for BOT Chain transactions. BOT Chain's base fee is 0 and blocks accept 20 gwei,
 * but `eth_gasPrice` fluctuates (20 ↔ 50 gwei observed 2026-10-10), so following it can overpay 2.5×.
 * Override with BOT_GAS_PRICE_GWEI if 20 gwei ever stops confirming.
 */
const gasPrice = Math.round(Number(env.BOT_GAS_PRICE_GWEI ?? 20) * 1e9);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    botTestnet: { url: BOT_TESTNET.rpc, chainId: BOT_TESTNET.chainId, accounts, gasPrice },
    botMainnet: { url: BOT_MAINNET.rpc, chainId: BOT_MAINNET.chainId, accounts, gasPrice },
  },
  // Both BOT Chain explorers run Blockscout, which accepts any API key.
  etherscan: {
    apiKey: { botTestnet: "blockscout", botMainnet: "blockscout" },
    customChains: [
      {
        network: "botTestnet",
        chainId: BOT_TESTNET.chainId,
        urls: { apiURL: `${BOT_TESTNET.explorer}/api`, browserURL: BOT_TESTNET.explorer },
      },
      {
        network: "botMainnet",
        chainId: BOT_MAINNET.chainId,
        urls: { apiURL: `${BOT_MAINNET.explorer}/api`, browserURL: BOT_MAINNET.explorer },
      },
    ],
  },
  sourcify: { enabled: false },
  gasReporter: { enabled: env.REPORT_GAS === "true" },
};

export default config;
