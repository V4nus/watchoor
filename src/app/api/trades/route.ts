import { NextRequest, NextResponse } from 'next/server';

export interface Trade {
  txHash: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  volumeUsd: number;
  timestamp: string;
  blockNumber: number;
}

interface GeckoTrade {
  attributes: {
    tx_hash: string;
    block_timestamp: string;
    block_number: number;
    kind: string;
    from_token_amount: string;
    to_token_amount: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
    volume_in_usd: string;
  };
}

// Map chain IDs to GeckoTerminal network names
const NETWORK_MAP: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  optimism: 'optimism',
  avalanche: 'avax',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!chainId || !poolAddress) {
    return NextResponse.json(
      { success: false, error: 'Missing chainId or poolAddress' },
      { status: 400 }
    );
  }

  try {
    const network = NETWORK_MAP[chainId] || chainId;

    // For V4 pools (66 char poolId), we need the actual pool address
    // Try to get it from DexScreener first
    let actualPoolAddress = poolAddress;

    if (poolAddress.length === 66) {
      // This is a V4 pool ID, try to find the actual pool via token
      // For now, return empty trades for V4 pools
      return NextResponse.json({
        success: true,
        data: [],
        message: 'V4 pool trades coming soon',
      });
    }

    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${actualPoolAddress}/trades?trade_volume_in_usd_greater_than=0`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 5 }, // Cache for 5 seconds
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal API error: ${response.status}`);
      return NextResponse.json({
        success: false,
        error: `API returned ${response.status}`,
      });
    }

    const result = await response.json();

    if (!result.data || !Array.isArray(result.data)) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Transform to our format
    const trades: Trade[] = result.data.slice(0, limit).map((trade: GeckoTrade) => {
      const attrs = trade.attributes;
      const isBuy = attrs.kind === 'buy';

      // For buy: from=quote(WETH), to=base(DRB) -> use price_to (base token price)
      // For sell: from=base(DRB), to=quote(WETH) -> use price_from (base token price)
      const baseTokenPrice = isBuy
        ? parseFloat(attrs.price_to_in_usd) || 0
        : parseFloat(attrs.price_from_in_usd) || 0;

      return {
        txHash: attrs.tx_hash,
        type: isBuy ? 'buy' : 'sell',
        price: baseTokenPrice,
        amount: parseFloat(isBuy ? attrs.to_token_amount : attrs.from_token_amount) || 0,
        volumeUsd: parseFloat(attrs.volume_in_usd) || 0,
        timestamp: attrs.block_timestamp,
        blockNumber: attrs.block_number,
      };
    });

    return NextResponse.json({
      success: true,
      data: trades,
    });
  } catch (error) {
    console.error('Trades API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
