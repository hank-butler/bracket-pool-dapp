import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet, foundry } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Bracket Pool',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'PLACEHOLDER',
  chains: [foundry, sepolia, mainnet],
  ssr: true,
});
