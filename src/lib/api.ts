import axios from 'axios';
import {
  OHLCVData,
  PoolInfo,
  SearchResult,
  TimeInterval,
  DexScreenerPair
} from '@/types';

// DexScreener API - for pool info and search
const DEXSCREENER_API = 'https://api.dexscreener.com';

// GeckoTerminal API - for OHLCV data (free, no API key needed)
const GECKOTERMINAL_API = 'https://api.geckoterminal.com/api/v2';

// ============ Client-side Cache ============
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const POOL_CACHE_TTL = 60000; // 1 minute for pool info
const OHLCV_CACHE_TTL = 30000; // 30 seconds for OHLCV
const SEARCH_CACHE_TTL = 30000; // 30 seconds for search

// In-memory cache (works for both SSR and client)
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Try to use localStorage on client side
function getFromLocalStorage<T>(key: string, ttl: number): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() - entry.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setToLocalStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage might be full or disabled
  }
}

function getFromMemoryCache<T>(key: string, ttl: number): T | null {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setToMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

function getCached<T>(key: string, ttl: number): T | null {
  // Try memory first (faster)
  const memResult = getFromMemoryCache<T>(key, ttl);
  if (memResult) return memResult;

  // Try localStorage
  const localResult = getFromLocalStorage<T>(key, ttl);
  if (localResult) {
    // Populate memory cache
    setToMemoryCache(key, localResult);
    return localResult;
  }

  return null;
}

function setCache<T>(key: string, data: T): void {
  setToMemoryCache(key, data);
  setToLocalStorage(key, data);
}

// Chain ID mapping for GeckoTerminal
const CHAIN_TO_GECKO: Record<string, string> = {
  'base': 'base',
  'ethereum': 'eth',
  'bsc': 'bsc',
  'arbitrum': 'arbitrum',
  'polygon': 'polygon_pos',
  'solana': 'solana',
};

// Time interval mapping for GeckoTerminal
const INTERVAL_TO_GECKO: Record<TimeInterval, { aggregate: number; timeframe: string }> = {
  '1m': { aggregate: 1, timeframe: 'minute' },
  '5m': { aggregate: 5, timeframe: 'minute' },
  '15m': { aggregate: 15, timeframe: 'minute' },
  '1h': { aggregate: 1, timeframe: 'hour' },
  '4h': { aggregate: 4, timeframe: 'hour' },
  '1d': { aggregate: 1, timeframe: 'day' },
  '1w': { aggregate: 1, timeframe: 'day' }, // Week not directly supported
};

/**
 * Fetch pool/pair information from DexScreener (with caching)
 */
export async function getPoolInfo(chainId: string, poolAddress: string): Promise<PoolInfo | null> {
  const cacheKey = `pool:${chainId}:${poolAddress.toLowerCase()}`;

  // Check cache first
  const cached = getCached<PoolInfo>(cacheKey, POOL_CACHE_TTL);
  if (cached) {
    console.log('Pool info cache hit:', cacheKey);
    return cached;
  }

  try {
    const response = await axios.get(
      `${DEXSCREENER_API}/latest/dex/pairs/${chainId}/${poolAddress}`
    );

    const pair: DexScreenerPair = response.data.pairs?.[0];
    if (!pair) return null;

    const poolInfo: PoolInfo = {
      chainId: pair.chainId,
      poolAddress: pair.pairAddress,
      dex: pair.dexId,
      baseToken: {
        address: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        decimals: 18, // DexScreener doesn't provide decimals
        imageUrl: pair.info?.imageUrl, // Token logo from DexScreener
      },
      quoteToken: {
        address: pair.quoteToken.address,
        name: pair.quoteToken.name,
        symbol: pair.quoteToken.symbol,
        decimals: 18,
        // Quote token logo - try to get from common tokens or leave undefined
      },
      priceUsd: parseFloat(pair.priceUsd) || 0,
      priceNative: parseFloat(pair.priceNative) || 0,
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      liquidityBase: pair.liquidity?.base || 0, // Base token amount (e.g., PING)
      liquidityQuote: pair.liquidity?.quote || 0, // Quote token amount (e.g., USDC)
      txns24h: {
        buys: pair.txns?.h24?.buys || 0,
        sells: pair.txns?.h24?.sells || 0,
      },
      createdAt: pair.pairCreatedAt
        ? new Date(pair.pairCreatedAt).toISOString()
        : undefined,
    };

    // Cache the result
    setCache(cacheKey, poolInfo);

    return poolInfo;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    return null;
  }
}

/**
 * Search for pools/pairs (with caching)
 */
export async function searchPools(query: string): Promise<SearchResult[]> {
  const cacheKey = `search:${query.toLowerCase()}`;

  // Check cache first
  const cached = getCached<SearchResult[]>(cacheKey, SEARCH_CACHE_TTL);
  if (cached) {
    console.log('Search cache hit:', query);
    return cached;
  }

  try {
    const response = await axios.get(
      `${DEXSCREENER_API}/latest/dex/search?q=${encodeURIComponent(query)}`
    );

    const results = (response.data.pairs || []).slice(0, 20).map((pair: DexScreenerPair) => ({
      chainId: pair.chainId,
      poolAddress: pair.pairAddress,
      baseToken: {
        address: pair.baseToken.address,
        name: pair.baseToken.name,
        symbol: pair.baseToken.symbol,
        decimals: 18,
        imageUrl: pair.info?.imageUrl,
      },
      quoteToken: {
        address: pair.quoteToken.address,
        name: pair.quoteToken.name,
        symbol: pair.quoteToken.symbol,
        decimals: 18,
      },
      dex: pair.dexId,
      priceUsd: parseFloat(pair.priceUsd) || 0,
      volume24h: pair.volume?.h24 || 0,
      imageUrl: pair.info?.imageUrl,
    }));

    // Cache the result
    setCache(cacheKey, results);

    return results;
  } catch (error) {
    console.error('Error searching pools:', error);
    return [];
  }
}

/**
 * Fetch OHLCV candlestick data from GeckoTerminal (with caching)
 */
export async function getOHLCVData(
  chainId: string,
  poolAddress: string,
  interval: TimeInterval = '1h',
  limit: number = 300
): Promise<OHLCVData[]> {
  const cacheKey = `ohlcv:${chainId}:${poolAddress.toLowerCase()}:${interval}`;

  // Check cache first
  const cached = getCached<OHLCVData[]>(cacheKey, OHLCV_CACHE_TTL);
  if (cached) {
    console.log('OHLCV cache hit:', cacheKey);
    return cached;
  }

  try {
    const geckoChain = CHAIN_TO_GECKO[chainId] || chainId;
    const { aggregate, timeframe } = INTERVAL_TO_GECKO[interval];

    const response = await axios.get(
      `${GECKOTERMINAL_API}/networks/${geckoChain}/pools/${poolAddress}/ohlcv/${timeframe}`,
      {
        params: {
          aggregate,
          limit,
          currency: 'usd',
        },
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    const ohlcvList = response.data?.data?.attributes?.ohlcv_list || [];

    // GeckoTerminal returns [timestamp, open, high, low, close, volume]
    // Timestamp could be in seconds or milliseconds - detect and convert
    const ohlcvData = ohlcvList.map((item: number[]) => {
      const timestamp = item[0];
      // If timestamp > 10^12, it's in milliseconds; otherwise seconds
      const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
      return {
        time: timeInSeconds,
        open: item[1],
        high: item[2],
        low: item[3],
        close: item[4],
        volume: item[5],
      };
    }).reverse(); // Reverse to get oldest first

    // Cache the result
    setCache(cacheKey, ohlcvData);

    return ohlcvData;
  } catch (error) {
    console.error('Error fetching OHLCV data:', error);
    return [];
  }
}

/**
 * Format number with appropriate suffix (K, M, B)
 */
export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(6);
  return num.toExponential(2);
}

/**
 * Format price with appropriate decimal places
 */
export function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(8);
  return price.toExponential(4);
}

/**
 * Format percentage change
 */
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
