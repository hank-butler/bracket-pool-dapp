'use client';

import { WalletButton } from '@/components/WalletButton';
import { usePools } from '@/hooks/usePools';
import { PoolCard } from '@/components/PoolCard';

export default function Home() {
  const { poolAddresses, isLoading } = usePools();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="panel-90s p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">
              <span className="star">&#9733;</span> Bracket Pools <span className="star">&#9733;</span>
            </h1>
            <WalletButton />
          </div>
        </div>
        <hr />
        {isLoading ? (
          <p>Loading pools...</p>
        ) : poolAddresses.length === 0 ? (
          <p>No pools created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {poolAddresses.map((addr) => (
              <PoolCard key={addr} address={addr} />
            ))}
          </div>
        )}

        <hr />
        <div className="text-center py-2">
          <span className="text-xs">
            You are visitor{' '}
            <span className="hit-counter-digit">0</span>
            <span className="hit-counter-digit">0</span>
            <span className="hit-counter-digit">3</span>
            <span className="hit-counter-digit">8</span>
            <span className="hit-counter-digit">4</span>
            {' '}since March 2026
          </span>
        </div>
        <p className="text-center text-[10px] text-[#808080]">
          Best viewed with Netscape Navigator 4.0 at 1024&times;768
          {' | '}
          <span className="blink text-[#ff0000]">&#9888;</span> <b>NEW!</b> Now on Ethereum!
        </p>
      </div>
    </main>
  );
}
