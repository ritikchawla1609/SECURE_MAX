import { ethers } from "ethers";

export function getChain1Provider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/alch_0qnxXuC1AluDumPOynCns';
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getChain1Signer(): ethers.Wallet {
  const privateKey = process.env.CHAIN1_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Blockchain unavailable: CHAIN1_DEPLOYER_PRIVATE_KEY is not set");
  }
  const provider = getChain1Provider();
  return new ethers.Wallet(privateKey, provider);
}
