import { NextResponse } from 'next/server';

// Cache for trending pools data
interface TrendingPool {
  symbol: string;
  name: string;
  pair: string;
  chain: string;
  chainLabel: string;
  poolAddress: string;
  logo: string;
  price: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  mcap: number;
  liquidityRatio: number;
}

interface CachedData {
  pools: TrendingPool[];
  timestamp: number;
}

// In-memory cache (persists across requests in the same server instance)
const cache: Record<string, CachedData> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour - data refreshes hourly from DexScreener

// DexScreener API
const DEXSCREENER_API = 'https://api.dexscreener.com';

// Chain configurations
const CHAIN_CONFIG: Record<string, { dexscreenerId: string; label: string }> = {
  base: { dexscreenerId: 'base', label: 'Base' },
  bsc: { dexscreenerId: 'bsc', label: 'BSC' },
  solana: { dexscreenerId: 'solana', label: 'SOL' },
  ethereum: { dexscreenerId: 'ethereum', label: 'ETH' },
};

// Fetch boosted/trending tokens and filter by chain
async function fetchBoostedTokens(chainId: string): Promise<TrendingPool[]> {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return [];

  try {
    // Get top boosted tokens from DexScreener
    const response = await fetch(
      `${DEXSCREENER_API}/token-boosts/top/v1`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      console.error(`DexScreener boosted API error: ${response.status}`);
      return [];
    }

    const boostedTokens = await response.json();

    // Filter tokens by chain
    const chainTokens = (boostedTokens || []).filter(
      (token: any) => token.chainId === config.dexscreenerId
    );

    if (chainTokens.length === 0) {
      console.log(`[Trending] No boosted tokens for ${chainId}, trying search...`);
      return [];
    }

    // Get token addresses to fetch pair data
    const tokenAddresses = chainTokens.slice(0, 30).map((t: any) => t.tokenAddress);

    // Fetch pair data for these tokens
    const pools: TrendingPool[] = [];

    // Batch tokens (max 30 per request)
    const batchSize = 30;
    for (let i = 0; i < tokenAddresses.length; i += batchSize) {
      const batch = tokenAddresses.slice(i, i + batchSize);
      const addressList = batch.join(',');

      try {
        const pairResponse = await fetch(
          `${DEXSCREENER_API}/tokens/v1/${config.dexscreenerId}/${addressList}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (pairResponse.ok) {
          const pairData = await pairResponse.json();
          const pairs = pairData || [];

          for (const pair of pairs) {
            if (!pair.pairAddress) continue;

            const liquidity = pair.liquidity?.usd || 0;
            const mcap = pair.fdv || pair.marketCap || liquidity * 10;
            const liquidityRatio = mcap > 0 ? (liquidity / mcap) * 100 : 0;

            pools.push({
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              name: pair.baseToken?.name || 'Unknown Token',
              pair: `${pair.baseToken?.symbol || '?'}/${pair.quoteToken?.symbol || '?'}`,
              chain: chainId,
              chainLabel: config.label,
              poolAddress: pair.pairAddress || '',
              logo: pair.info?.imageUrl || '',
              price: parseFloat(pair.priceUsd) || 0,
              change24h: pair.priceChange?.h24 || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: liquidity,
              mcap: mcap,
              liquidityRatio: liquidityRatio,
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching pair data for batch:`, err);
      }
    }

    // Sort by volume and dedupe by symbol
    const seen = new Set<string>();
    return pools
      .filter((p) => p.liquidity > 10000 && p.volume24h > 1000)
      .sort((a, b) => b.volume24h - a.volume24h)
      .filter((p) => {
        if (seen.has(p.symbol)) return false;
        seen.add(p.symbol);
        return true;
      })
      .slice(0, 30);

  } catch (error) {
    console.error(`Error fetching boosted tokens for ${chainId}:`, error);
    return [];
  }
}

// Fallback: Search for trending tokens by chain using search API
async function fetchTrendingBySearch(chainId: string): Promise<TrendingPool[]> {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return [];

  try {
    // Use search with popular terms for each chain
    const searchTerms: Record<string, string[]> = {
      base: ['WETH', 'USDC', 'BRETT', 'DEGEN', 'TOSHI'],
      bsc: ['WBNB', 'CAKE', 'USDT', 'BUSD'],
      solana: ['SOL', 'USDC', 'BONK', 'WIF'],
      ethereum: ['WETH', 'USDC', 'PEPE', 'SHIB'],
    };

    const terms = searchTerms[chainId] || ['WETH', 'USDC'];
    const allPools: TrendingPool[] = [];

    for (const term of terms) {
      try {
        const response = await fetch(
          `${DEXSCREENER_API}/latest/dex/search?q=${term}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const pairs = (data.pairs || []).filter(
            (p: any) => p.chainId === config.dexscreenerId
          );

          for (const pair of pairs.slice(0, 10)) {
            const liquidity = pair.liquidity?.usd || 0;
            const mcap = pair.fdv || pair.marketCap || liquidity * 10;
            const liquidityRatio = mcap > 0 ? (liquidity / mcap) * 100 : 0;

            allPools.push({
              symbol: pair.baseToken?.symbol || 'UNKNOWN',
              name: pair.baseToken?.name || 'Unknown Token',
              pair: `${pair.baseToken?.symbol || '?'}/${pair.quoteToken?.symbol || '?'}`,
              chain: chainId,
              chainLabel: config.label,
              poolAddress: pair.pairAddress || '',
              logo: pair.info?.imageUrl || '',
              price: parseFloat(pair.priceUsd) || 0,
              change24h: pair.priceChange?.h24 || 0,
              volume24h: pair.volume?.h24 || 0,
              liquidity: liquidity,
              mcap: mcap,
              liquidityRatio: liquidityRatio,
            });
          }
        }
      } catch (err) {
        console.error(`Search error for ${term}:`, err);
      }
    }

    // Sort by volume and dedupe
    const seen = new Set<string>();
    return allPools
      .filter((p) => p.liquidity > 10000 && p.volume24h > 1000)
      .sort((a, b) => b.volume24h - a.volume24h)
      .filter((p) => {
        if (seen.has(p.symbol)) return false;
        seen.add(p.symbol);
        return true;
      })
      .slice(0, 30);

  } catch (error) {
    console.error(`Error searching trending for ${chainId}:`, error);
    return [];
  }
}

async function fetchTrendingFromDexScreener(chainId: string): Promise<TrendingPool[]> {
  // Try boosted tokens first
  let pools = await fetchBoostedTokens(chainId);

  // Fallback to search if no boosted tokens found
  if (pools.length === 0) {
    console.log(`[Trending] Using search fallback for ${chainId}`);
    pools = await fetchTrendingBySearch(chainId);
  }

  console.log(`[Trending] Found ${pools.length} pools for ${chainId}`);
  return pools;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain') || 'base';

  // Check cache
  const cached = cache[chain];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      pools: cached.pools,
      cached: true,
      cacheAge: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }

  // Fetch fresh data
  const pools = await fetchTrendingFromDexScreener(chain);

  // Update cache
  cache[chain] = {
    pools,
    timestamp: Date.now(),
  };

  return NextResponse.json({
    pools,
    cached: false,
    cacheAge: 0,
  });
}

// Endpoint to pre-warm cache for all chains
export async function POST() {
  const chains = Object.keys(CHAIN_CONFIG);
  const results: Record<string, number> = {};

  await Promise.all(
    chains.map(async (chain) => {
      const pools = await fetchTrendingFromDexScreener(chain);
      cache[chain] = {
        pools,
        timestamp: Date.now(),
      };
      results[chain] = pools.length;
    })
  );

  return NextResponse.json({
    message: 'Cache warmed',
    results,
  });
}
