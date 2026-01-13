// Chain configurations
export interface Chain {
  id: string;
  name: string;
  icon: string;
  explorer: string;
}

export const SUPPORTED_CHAINS: Chain[] = [
  { id: 'base', name: 'Base', icon: '🔵', explorer: 'https://basescan.org' },
  { id: 'ethereum', name: 'Ethereum', icon: '⟠', explorer: 'https://etherscan.io' },
  { id: 'bsc', name: 'BNB Chain', icon: '🟡', explorer: 'https://bscscan.com' },
  { id: 'arbitrum', name: 'Arbitrum', icon: '🔷', explorer: 'https://arbiscan.io' },
  { id: 'polygon', name: 'Polygon', icon: '🟣', explorer: 'https://polygonscan.com' },
  { id: 'solana', name: 'Solana', icon: '◎', explorer: 'https://solscan.io' },
];

// Pool/Pair information
export interface PoolInfo {
  chainId: string;
  poolAddress: string;
  dex: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  priceUsd: number;
  priceNative: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  liquidityBase?: number; // Base token amount in pool (e.g., PING)
  liquidityQuote?: number; // Quote token amount in pool (e.g., USDC)
  txns24h: {
    buys: number;
    sells: number;
  };
  createdAt?: string;
}

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  imageUrl?: string; // Token logo URL from DexScreener
}

// OHLCV candlestick data
export interface OHLCVData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Time intervals for charts
export type TimeInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export const TIME_INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

// Search result
export interface SearchResult {
  chainId: string;
  poolAddress: string;
  baseToken: TokenInfo;
  quoteToken: TokenInfo;
  dex: string;
  priceUsd: number;
  volume24h: number;
  imageUrl?: string; // Pool/token image from DexScreener
}

// API Response types
export interface DexPaprikaOHLCV {
  time_open: string;
  time_close: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    h24: { buys: number; sells: number };
  };
  volume: { h24: number };
  priceChange: { h24: number };
  liquidity: { usd: number; base?: number; quote?: number };
  fdv: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string; // Token logo URL
    header?: string;
    openGraph?: string;
    websites?: { label: string; url: string }[];
    socials?: { type: string; url: string }[];
  };
}
