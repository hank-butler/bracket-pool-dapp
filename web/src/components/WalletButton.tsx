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
        className="btn-90s"
      >
        <code>{address.slice(0, 6)}...{address.slice(-4)}</code>
      </button>
    );
  }

  if (connectors.length === 0) {
    return (
      <span className="panel-90s-inset p-2 text-xs status-error">
        No wallet detected &mdash; install MetaMask
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          onClick={() => connect({ connector })}
          className="btn-90s-primary"
        >
          Connect {connector.name}
        </button>
      ))}
      {error && <span className="text-xs status-error">{error.message}</span>}
    </div>
  );
}

export function WalletButton() {
  if (hasRainbowKit) {
    return <RainbowConnectButton />;
  }
  return <InjectedButton />;
}
