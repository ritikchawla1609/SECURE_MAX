import { http, createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const rpcUrl = process.env.NEXT_PUBLIC_CHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/alch_0qnxXuC1AluDumPOynCns';

export const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
});
