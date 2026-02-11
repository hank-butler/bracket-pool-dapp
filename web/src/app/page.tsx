'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { usePools } from '@/hooks/usePools';
import { PoolCard } from '@/components/PoolCard';

export default function Home() {
  const { poolAddresses, isLoading } = usePools();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Bracket Pools</h1>
          <ConnectButton />
        </div>
        {isLoading ? (
          <p>Loading pools...</p>
        ) : poolAddresses.length === 0 ? (
          <p className="text-gray-500">No pools created yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {poolAddresses.map((addr) => (
              <PoolCard key={addr} address={addr} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
