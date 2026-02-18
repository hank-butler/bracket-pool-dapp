import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { sepolia, mainnet, foundry } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const hasRainbowKit = !!(projectId && projectId !== 'PLACEHOLDER');

export const config = projectId && projectId !== 'PLACEHOLDER'
  ? getDefaultConfig({
      appName: 'Bracket Pool',
      projectId,
      chains: [sepolia, mainnet, foundry],
      ssr: true,
    })
  : createConfig({
      chains: [sepolia, mainnet, foundry],
      connectors: [injected()],
      transports: {
        [foundry.id]: http(),
        [sepolia.id]: http(),
        [mainnet.id]: http(),
      },
      ssr: true,
    });
