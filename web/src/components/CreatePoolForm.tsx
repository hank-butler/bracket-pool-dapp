'use client';

import { useState } from 'react';
import { parseUnits } from 'viem';
import { useCreatePool } from '@/hooks/useAdminPool';

const SPORTS = [
  { label: 'March Madness', value: 'marchmadness', gameCount: 63 },
  { label: 'World Cup', value: 'worldcup', gameCount: 88 },
];

export function CreatePoolForm() {
  const [poolName, setPoolName] = useState('');
  const [sport, setSport] = useState(SPORTS[0]);
  const [lockTime, setLockTime] = useState('');
  const [finalizeDeadline, setFinalizeDeadline] = useState('');
  const [basePrice, setBasePrice] = useState('10');
  const [priceSlope, setPriceSlope] = useState('100');

  const { createPool, isPending, isConfirming, isSuccess, error } = useCreatePool();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createPool({
      poolName,
      gameCount: sport.gameCount,
      lockTime: Math.floor(new Date(lockTime).getTime() / 1000),
      finalizeDeadline: Math.floor(new Date(finalizeDeadline).getTime() / 1000),
      basePrice: parseUnits(basePrice, 6),
      priceSlope: BigInt(priceSlope),
    });
  }

  return (
    <div className="panel-90s p-4 mb-4">
      <h2 className="text-lg mb-2">Create Pool</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-bold mb-1">Pool Name</label>
          <input className="input-90s w-full" value={poolName} onChange={e => setPoolName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Sport</label>
          <select
            className="input-90s w-full"
            value={sport.value}
            onChange={e => setSport(SPORTS.find(s => s.value === e.target.value)!)}
          >
            {SPORTS.map(s => (
              <option key={s.value} value={s.value}>{s.label} ({s.gameCount} games)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Lock Time</label>
          <input
            type="datetime-local"
            className="input-90s w-full"
            value={lockTime}
            onChange={e => setLockTime(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Finalize Deadline</label>
          <input
            type="datetime-local"
            className="input-90s w-full"
            value={finalizeDeadline}
            onChange={e => setFinalizeDeadline(e.target.value)}
            required
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold mb-1">Base Price (USDC)</label>
            <input
              className="input-90s w-full"
              type="number"
              value={basePrice}
              onChange={e => setBasePrice(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-bold mb-1">Price Slope (bps)</label>
            <input
              className="input-90s w-full"
              type="number"
              value={priceSlope}
              onChange={e => setPriceSlope(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-90s" disabled={isPending || isConfirming}>
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Creating...' : 'Create Pool'}
        </button>
        {isSuccess && <p className="text-green-700 text-sm">Pool created!</p>}
        {error && <p className="status-error text-sm">{error.message}</p>}
      </form>
    </div>
  );
}
