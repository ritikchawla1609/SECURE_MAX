import { ethers } from "ethers";

export function getChain2Provider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL; // Using same RPC for now if unspecified
  if (!rpcUrl) {
    throw new Error("Blockchain unavailable: NEXT_PUBLIC_CHAIN_RPC_URL is not set");
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

export function getChain2Signer(): ethers.Wallet {
  const privateKey = process.env.CHAIN2_DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Blockchain unavailable: CHAIN2_DEPLOYER_PRIVATE_KEY is not set");
  }
  const provider = getChain2Provider();
  return new ethers.Wallet(privateKey, provider);
}
