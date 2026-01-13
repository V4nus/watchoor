import { NextRequest, NextResponse } from 'next/server';
import { getLiquidityDepth, getSimpleLiquidity, getV4LiquidityDepth } from '@/lib/liquidity';
import { getLatestLiquidityFromDb, syncLiquidityDepth, syncPoolInfo } from '@/lib/db-sync';

// Validate EVM address (20 bytes = 40 hex chars + 0x prefix)
function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Check if it's a V4 pool ID (32 bytes = 64 hex chars + 0x prefix)
function isV4PoolId(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');
  const priceUsd = parseFloat(searchParams.get('priceUsd') || '0');
  const token0Address = searchParams.get('token0Address');
  const token1Address = searchParams.get('token1Address');
  const range = parseInt(searchParams.get('range') || '100'); // 50 or 100 percent
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Pass range directly as the max percentage for depth levels
  const levels = range; // 50 means ±50%, 100 means ±100%

  if (!chainId || !poolAddress) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  if (chainId === 'solana') {
    return NextResponse.json({ error: 'Solana not supported yet' }, { status: 400 });
  }

  const cacheHeaders = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' };

  try {
    // Try database first (unless force refresh)
    if (!forceRefresh && !isV4PoolId(poolAddress)) {
      try {
        const dbData = await getLatestLiquidityFromDb(chainId, poolAddress);
        if (dbData && (dbData.bids.length > 0 || dbData.asks.length > 0)) {
          console.log('Serving liquidity from database');
          return NextResponse.json(
            { type: 'depth', data: dbData, version: 'v3', source: 'database' },
            { headers: cacheHeaders }
          );
        }
      } catch (dbError) {
        console.warn('Database lookup failed, falling back to RPC:', dbError);
      }
    }

    // Check if this is a V4 pool ID (64 hex chars)
    if (isV4PoolId(poolAddress)) {
      if (!token0Address || !token1Address) {
        return NextResponse.json({
          error: 'V4 pools require token addresses'
        }, { status: 400 });
      }

      const depth = await getV4LiquidityDepth(
        chainId,
        poolAddress,
        priceUsd,
        token0Address,
        token1Address,
        levels
      );

      if (depth && (depth.bids.length > 0 || depth.asks.length > 0)) {
        return NextResponse.json(
          { type: 'depth', data: depth, version: 'v4', source: 'rpc' },
          { headers: cacheHeaders }
        );
      }

      return NextResponse.json({ error: 'No V4 liquidity data available' }, { status: 404 });
    }

    // Check if address is valid V3 EVM format
    if (!isValidEvmAddress(poolAddress)) {
      return NextResponse.json({
        error: 'Pool address format not supported for on-chain queries. This may be a non-standard pool type.'
      }, { status: 400 });
    }

    // Try V3 depth from RPC
    const depth = await getLiquidityDepth(chainId, poolAddress, priceUsd, levels);

    if (depth && (depth.bids.length > 0 || depth.asks.length > 0)) {
      // Save to database in background (don't await)
      syncPoolInfo(chainId, poolAddress).catch(console.error);
      syncLiquidityDepth(chainId, poolAddress, priceUsd).catch(console.error);

      return NextResponse.json(
        { type: 'depth', data: depth, version: 'v3', source: 'rpc' },
        { headers: cacheHeaders }
      );
    }

    // Fallback to simple liquidity (V2 style)
    const simple = await getSimpleLiquidity(chainId, poolAddress);
    if (simple) {
      return NextResponse.json(
        { type: 'simple', data: simple, version: 'v2', source: 'rpc' },
        { headers: cacheHeaders }
      );
    }

    return NextResponse.json({ error: 'No liquidity data available for this pool' }, { status: 404 });
  } catch (error) {
    console.error('Liquidity API error:', error);
    return NextResponse.json({ error: 'Failed to fetch liquidity data' }, { status: 500 });
  }
}
