import { NextRequest, NextResponse } from 'next/server';
import { getPoolInfo } from '@/lib/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');

  if (!chainId || !poolAddress) {
    return NextResponse.json(
      { success: false, error: 'Missing chainId or poolAddress' },
      { status: 400 }
    );
  }

  try {
    const poolInfo = await getPoolInfo(chainId, poolAddress);

    if (!poolInfo) {
      return NextResponse.json(
        { success: false, error: 'Pool not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        priceUsd: poolInfo.priceUsd,
        priceNative: poolInfo.priceNative,
        priceChange24h: poolInfo.priceChange24h,
        volume24h: poolInfo.volume24h,
        liquidity: poolInfo.liquidity,
        txns24h: poolInfo.txns24h,
      },
    });
  } catch (error) {
    console.error('Pool API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pool data' },
      { status: 500 }
    );
  }
}
