import { NextRequest, NextResponse } from 'next/server';
import { syncPoolInfo, syncLiquidityDepth, syncWatchedPools } from '@/lib/db-sync';

// API key for sync endpoint (set in .env)
const SYNC_API_KEY = process.env.SYNC_API_KEY;

export async function POST(request: NextRequest) {
  // Verify API key
  const authHeader = request.headers.get('authorization');
  if (SYNC_API_KEY && authHeader !== `Bearer ${SYNC_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, chainId, poolAddress, priceUsd } = body;

    switch (action) {
      case 'sync_pool':
        if (!chainId || !poolAddress) {
          return NextResponse.json({ error: 'Missing chainId or poolAddress' }, { status: 400 });
        }
        const pool = await syncPoolInfo(chainId, poolAddress);
        return NextResponse.json({ success: true, pool });

      case 'sync_liquidity':
        if (!chainId || !poolAddress || !priceUsd) {
          return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }
        const snapshot = await syncLiquidityDepth(chainId, poolAddress, priceUsd);
        return NextResponse.json({ success: true, snapshot });

      case 'sync_all':
        // Sync all watched pools (background job)
        syncWatchedPools().catch(console.error);
        return NextResponse.json({ success: true, message: 'Sync started in background' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

// GET endpoint for cron jobs
export async function GET(request: NextRequest) {
  // Verify API key
  const apiKey = request.nextUrl.searchParams.get('key');
  if (SYNC_API_KEY && apiKey !== SYNC_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run sync for all watched pools
    await syncWatchedPools();
    return NextResponse.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
