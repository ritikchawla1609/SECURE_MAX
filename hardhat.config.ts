import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun"
    },
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: process.env.NEXT_PUBLIC_CHAIN_RPC_URL || "",
      accounts: process.env.CHAIN1_DEPLOYER_PRIVATE_KEY ? [process.env.CHAIN1_DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
