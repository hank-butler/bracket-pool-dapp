'use client';

import dynamic from 'next/dynamic';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { hasRainbowKit } from '@/lib/wagmi';

const RainbowConnectButton = dynamic(
  () => import('@rainbow-me/rainbowkit').then((mod) => ({ default: mod.ConnectButton })),
  { ssr: false },
);

function InjectedButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-lg border"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  if (connectors.length === 0) {
    return (
      <span className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
        No wallet detected — install MetaMask
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          onClick={() => connect({ connector })}}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
        >
          Connect {connector.name}
        </button>
      ))}
      {error && <span className="text-sm text-red-500">{error.message}</span>}
    </div>
  );
}

export function WalletButton() {
  if (hasRainbowKit) {
    return <RainbowConnectButton />;
  }
  return <InjectedButton />;
}
