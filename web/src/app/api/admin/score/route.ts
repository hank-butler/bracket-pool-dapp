import { NextRequest, NextResponse } from 'next/server';
import type { Address } from 'viem';
import { pinJSON } from '@/lib/pinata';
import { runScorer } from '@/scorer/pipeline';

export async function POST(req: NextRequest) {
  try {
    const { poolAddress, tiebreaker } = await req.json();

    if (!poolAddress || tiebreaker === undefined) {
      return NextResponse.json({ error: 'Missing poolAddress or tiebreaker' }, { status: 400 });
    }

    const rpcUrl = process.env.SCORER_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: 'SCORER_RPC_URL not configured' }, { status: 500 });
    }

    const output = await runScorer(poolAddress as Address, rpcUrl, tiebreaker);

    const serialized = JSON.parse(
      JSON.stringify(output, (_, v) => typeof v === 'bigint' ? v.toString() : v)
    );

    const proofsCID = process.env.PINATA_JWT
      ? await pinJSON(serialized, `proofs-${poolAddress}`)
      : `local-${poolAddress.slice(2, 10)}`;

    return NextResponse.json({
      merkleRoot: output.merkleRoot,
      proofsCID,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
