import { ethers, network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Deploys StakeMarkets and writes deployments/<chainId>.json, which the web app and
 * resolver read for the contract address and the block to start indexing from.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in contracts/.env");

  const { chainId } = await ethers.provider.getNetwork();
  const creator = process.env.STAKE_CREATOR_ADDRESS || deployer.address;
  const resolver = process.env.STAKE_RESOLVER_ADDRESS || deployer.address;
  const treasury = process.env.STAKE_TREASURY_ADDRESS || deployer.address;
  const feeBps = Number(process.env.STAKE_FEE_BPS ?? 100);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network   ${network.name} (chainId ${chainId})`);
  console.log(`deployer  ${deployer.address}  balance ${ethers.formatEther(balance)} BOT`);
  console.log(`roles     creator ${creator}  resolver ${resolver}  treasury ${treasury}  fee ${feeBps} bps`);

  const Factory = await ethers.getContractFactory("StakeMarkets");
  const contract = await Factory.deploy(deployer.address, creator, resolver, treasury, feeBps);
  const tx = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const receipt = await tx!.wait();
  const address = await contract.getAddress();

  const record = {
    network: network.name,
    chainId: Number(chainId),
    address,
    deployBlock: receipt!.blockNumber,
    deployTx: receipt!.hash,
    owner: deployer.address,
    creator,
    resolver,
    treasury,
    feeBps,
    constructorArgs: [deployer.address, creator, resolver, treasury, feeBps],
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${chainId}.json`), JSON.stringify(record, null, 2) + "\n");

  console.log(`StakeMarkets deployed at ${address} (block ${record.deployBlock}, tx ${record.deployTx})`);
  if (network.name.startsWith("bot")) {
    console.log(`verify with: npx hardhat verify --network ${network.name} ${address} ${record.constructorArgs.join(" ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
