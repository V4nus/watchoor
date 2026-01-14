// Quote token USD price service
// Fetches and caches USD prices for common quote tokens (ETH, BNB, MATIC, etc.)

import axios from 'axios';

// Common quote tokens and their CoinGecko IDs
const QUOTE_TOKEN_IDS: Record<string, string> = {
  // Ethereum ecosystem
  'ETH': 'ethereum',
  'WETH': 'ethereum',
  'STETH': 'staked-ether',
  'WSTETH': 'wrapped-steth',

  // BNB Chain
  'BNB': 'binancecoin',
  'WBNB': 'binancecoin',

  // Polygon
  'MATIC': 'matic-network',
  'WMATIC': 'matic-network',
  'POL': 'matic-network',

  // Avalanche
  'AVAX': 'avalanche-2',
  'WAVAX': 'avalanche-2',

  // Solana
  'SOL': 'solana',
  'WSOL': 'solana',

  // Arbitrum
  'ARB': 'arbitrum',

  // Optimism
  'OP': 'optimism',

  // Stablecoins (always $1)
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai',
  'BUSD': 'binance-usd',
  'FRAX': 'frax',
  'TUSD': 'true-usd',
  'USDP': 'paxos-standard',
  'GUSD': 'gemini-dollar',
  'LUSD': 'liquity-usd',

  // BTC
  'BTC': 'bitcoin',
  'WBTC': 'wrapped-bitcoin',
  'BTCB': 'bitcoin-bep2',
};

// Stablecoins that are always ~$1
const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'FRAX', 'TUSD', 'USDP', 'GUSD', 'LUSD', 'UST', 'MIM',
]);

// Cache for prices
interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_TTL = 60000; // 1 minute cache
const LOCALSTORAGE_KEY = 'quote_prices_cache';

// Request deduplication: prevent multiple identical requests
const pendingRequests = new Map<string, Promise<number>>();

// Load cache from localStorage on init
function loadCacheFromLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as Record<string, PriceCache>;
      const now = Date.now();
      for (const [symbol, entry] of Object.entries(data)) {
        // Only load entries that haven't expired
        if (now - entry.timestamp < CACHE_TTL * 5) { // 5 minute localStorage TTL
          priceCache.set(symbol, entry);
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

// Save cache to localStorage
function saveCacheToLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const data: Record<string, PriceCache> = {};
    priceCache.forEach((value, key) => {
      data[key] = value;
    });
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full
  }
}

// Initialize cache from localStorage
if (typeof window !== 'undefined') {
  loadCacheFromLocalStorage();
}

/**
 * Check if a token is a stablecoin
 */
export function isStablecoin(symbol: string): boolean {
  return STABLECOINS.has(symbol.toUpperCase());
}

/**
 * Get USD price for a quote token
 * Returns the cached price if available and not expired
 */
export async function getQuoteTokenUsdPrice(symbol: string): Promise<number> {
  const upperSymbol = symbol.toUpperCase();

  // Stablecoins are always $1
  if (isStablecoin(upperSymbol)) {
    return 1;
  }

  // Check cache
  const cached = priceCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  // Check if request is already pending (deduplication)
  if (pendingRequests.has(upperSymbol)) {
    return pendingRequests.get(upperSymbol)!;
  }

  // Get CoinGecko ID
  const coinId = QUOTE_TOKEN_IDS[upperSymbol];
  if (!coinId) {
    console.warn(`Unknown quote token: ${symbol}, returning 0`);
    return 0;
  }

  // Create promise for this request
  const fetchPromise = (async () => {
    try {
      // Fetch from CoinGecko
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { timeout: 5000 }
      );

      const price = response.data[coinId]?.usd || 0;

      // Cache the result
      priceCache.set(upperSymbol, {
        price,
        timestamp: Date.now(),
      });
      saveCacheToLocalStorage();

      return price;
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);

      // Return cached price if available (even if expired)
      if (cached) {
        return cached.price;
      }

      // Fallback prices for common tokens (in case API fails)
      const fallbackPrices: Record<string, number> = {
        'ETH': 3500,
        'WETH': 3500,
        'BNB': 600,
        'WBNB': 600,
        'MATIC': 0.8,
        'WMATIC': 0.8,
        'SOL': 200,
        'WSOL': 200,
        'BTC': 100000,
        'WBTC': 100000,
        'AVAX': 35,
        'WAVAX': 35,
      };

      return fallbackPrices[upperSymbol] || 0;
    } finally {
      // Clean up pending request
      pendingRequests.delete(upperSymbol);
    }
  })();

  // Store pending request
  pendingRequests.set(upperSymbol, fetchPromise);

  return fetchPromise;
}

/**
 * Batch fetch USD prices for multiple tokens
 */
export async function getQuoteTokenUsdPrices(symbols: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const tokensToFetch: string[] = [];

  // Check cache and identify stablecoins
  for (const symbol of symbols) {
    const upperSymbol = symbol.toUpperCase();

    if (isStablecoin(upperSymbol)) {
      result[upperSymbol] = 1;
      continue;
    }

    const cached = priceCache.get(upperSymbol);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      result[upperSymbol] = cached.price;
      continue;
    }

    tokensToFetch.push(upperSymbol);
  }

  if (tokensToFetch.length === 0) {
    return result;
  }

  // Get CoinGecko IDs for remaining tokens
  const coinIds = tokensToFetch
    .map(s => QUOTE_TOKEN_IDS[s])
    .filter(Boolean);

  if (coinIds.length === 0) {
    return result;
  }

  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
      { timeout: 5000 }
    );

    // Map prices back to symbols
    for (const symbol of tokensToFetch) {
      const coinId = QUOTE_TOKEN_IDS[symbol];
      if (coinId && response.data[coinId]) {
        const price = response.data[coinId].usd || 0;
        result[symbol] = price;
        priceCache.set(symbol, { price, timestamp: Date.now() });
      }
    }
    saveCacheToLocalStorage();
  } catch (error) {
    console.error('Failed to batch fetch prices:', error);
  }

  return result;
}

/**
 * Convert amount from quote token to USD
 */
export function convertToUsd(amount: number, quoteTokenSymbol: string, quoteTokenUsdPrice: number): number {
  if (isStablecoin(quoteTokenSymbol)) {
    return amount;
  }
  return amount * quoteTokenUsdPrice;
}

/**
 * Format USD value
 */
export function formatUsd(value: number): string {
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01) return '$' + value.toFixed(4);
  return '$' + value.toFixed(6);
}
