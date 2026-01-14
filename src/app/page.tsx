'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, TrendingUp, Droplets, BarChart3, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { formatNumber, formatPrice } from '@/lib/api';

// Chain logos - use local files
const CHAIN_LOGOS: Record<string, string> = {
  base: '/chains/base.svg',
  bsc: '/chains/bsc.svg',
  solana: '/chains/solana.png',
  ethereum: '/chains/ethereum.png',
};

const CHAINS = [
  { id: 'base', label: 'Base', logo: CHAIN_LOGOS.base },
  { id: 'bsc', label: 'BSC', logo: CHAIN_LOGOS.bsc },
  { id: 'solana', label: 'SOL', logo: CHAIN_LOGOS.solana },
  { id: 'ethereum', label: 'ETH', logo: CHAIN_LOGOS.ethereum },
];

// Local token icons mapping (downloaded to /public/tokens/)
// For tokens without local icons, we use CoinGecko API as fallback
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  // Base tokens
  DEGEN: '/tokens/degen.png',
  BRETT: '/tokens/brett.png',
  AERO: '/tokens/aero.png',
  cbBTC: '/tokens/cbbtc.webp',
  // BSC tokens
  BAKE: '/tokens/bake.jpg',
  XVS: '/tokens/xvs.png',
  BSW: '/tokens/bsw.png',
  TWT: '/tokens/twt.png',
  SFP: '/tokens/sfp.png',
  // Solana tokens
  WIF: '/tokens/wif.jpg',
  BONK: '/tokens/bonk.jpg',
  PYTH: '/tokens/pyth.png',
  JUP: '/tokens/jup.png',
  // Ethereum tokens
  PEPE: '/tokens/pepe.jpg',
  FLOKI: '/tokens/floki.png',
  SHIB: '/tokens/shib.png',
};

// Token icons from multiple sources with correct URLs
// Priority: Local > DexScreener CDN > CoinGecko
const TOKEN_ICONS: Record<string, string> = {
  // Base tokens - using DexScreener/verified URLs
  PING: 'https://cdn.dexscreener.com/cms/images/66fccd9c55c6a79e5aea763ede2b67b11ed1ddf3479839f904d894d3939ef200?width=64&height=64&quality=90',
  TOSHI: 'https://dd.dexscreener.com/ds-data/tokens/base/0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4.png',
  VIRTUAL: 'https://dd.dexscreener.com/ds-data/tokens/base/0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b.png',
  WELL: 'https://dd.dexscreener.com/ds-data/tokens/base/0xa88594d404727625a9437c3f886c7643872296ae.png',
  EXTRA: 'https://dd.dexscreener.com/ds-data/tokens/base/0x2dad3a13ef0c6366220f989157009e501e7938f8.png',
  BALD: 'https://dd.dexscreener.com/ds-data/tokens/base/0x27d2decb4bfc9c76f0309b8e88dec3a601fe25a8.png',
  BASED: 'https://dd.dexscreener.com/ds-data/tokens/base/0x32e0f9d26d1e33625e3b4aa57d0c4c4e0e014c56.png',
  // BSC tokens
  CAKE: 'https://dd.dexscreener.com/ds-data/tokens/bsc/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82.png',
  ALPACA: 'https://dd.dexscreener.com/ds-data/tokens/bsc/0x8f0528ce5ef7b51152a59745befdd91d97091d2f.png',
  RACA: 'https://dd.dexscreener.com/ds-data/tokens/bsc/0x12bb890508c125661e03b09ec06e404bc9289040.png',
  BABY: 'https://dd.dexscreener.com/ds-data/tokens/bsc/0x53e562b9b7e5e94b81f10e96ee70ad06df3d2657.png',
  LINA: 'https://dd.dexscreener.com/ds-data/tokens/bsc/0x762539b45a1dcce3d36d080f74d1aed37844b878.png',
  // Solana tokens
  JTO: 'https://dd.dexscreener.com/ds-data/tokens/solana/jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL.png',
  ORCA: 'https://dd.dexscreener.com/ds-data/tokens/solana/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE.png',
  RAY: 'https://dd.dexscreener.com/ds-data/tokens/solana/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png',
  POPCAT: 'https://dd.dexscreener.com/ds-data/tokens/solana/7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr.png',
  RENDER: 'https://dd.dexscreener.com/ds-data/tokens/solana/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof.png',
  KMNO: 'https://dd.dexscreener.com/ds-data/tokens/solana/KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS.png',
  // Ethereum tokens
  MOG: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0xaaee1a9723aadb7afa2810263653a34ba2c21c7a.png',
  TURBO: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0xa35923162c49cf95e6bf26623385eb431ad920d3.png',
  APE: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x4d224452801aced8b2f0aebe155379bb5d594381.png',
  LDO: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x5a98fcbea516cf06857215779fd812ca3bef1b32.png',
  UNI: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x1f9840a85d5af5bf1d1762f925bdaddc4201f984.png',
  AAVE: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9.png',
  ENS: 'https://dd.dexscreener.com/ds-data/tokens/ethereum/0xc18360217d8f7ab5e7c516566761ea12ce7f9d72.png',
};

const getTokenLogo = (symbol: string): string => {
  // First check local icons
  if (LOCAL_TOKEN_ICONS[symbol]) {
    return LOCAL_TOKEN_ICONS[symbol];
  }
  // Then check DexScreener CDN icons
  if (TOKEN_ICONS[symbol]) {
    return TOKEN_ICONS[symbol];
  }
  return '';
};

// Get fallback icon URLs for tokens (used when primary icon fails)
const getFallbackIcons = (symbol: string): string[] => {
  const tokenInfo = TOKEN_ADDRESSES[symbol];
  if (!tokenInfo) return [];
  // Use server-cached API as fallback
  return [`/api/token-icon?chain=${tokenInfo.chain}&address=${tokenInfo.address}`];
};

// Token contract addresses for icon caching
const TOKEN_ADDRESSES: Record<string, { chain: string; address: string }> = {
  // Base tokens
  PING: { chain: 'base', address: '0xb7e04DEE3Ee60F5990Ea34C4E5Cc816ac87E8e63' },
  DEGEN: { chain: 'base', address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
  BRETT: { chain: 'base', address: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
  TOSHI: { chain: 'base', address: '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4' },
  AERO: { chain: 'base', address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631' },
  VIRTUAL: { chain: 'base', address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b' },
  WELL: { chain: 'base', address: '0xa88594d404727625a9437c3f886c7643872296ae' },
  EXTRA: { chain: 'base', address: '0x2dad3a13ef0c6366220f989157009e501e7938f8' },
  BALD: { chain: 'base', address: '0x27d2decb4bfc9c76f0309b8e88dec3a601fe25a8' },
  BASED: { chain: 'base', address: '0x32e0f9d26d1e33625e3b4aa57d0c4c4e0e014c56' },
  cbBTC: { chain: 'base', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf' },
  // BSC tokens
  CAKE: { chain: 'bsc', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' },
  BAKE: { chain: 'bsc', address: '0xe02df9e3e622debdd69fb838bb799e3f168902c5' },
  XVS: { chain: 'bsc', address: '0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63' },
  ALPACA: { chain: 'bsc', address: '0x8f0528ce5ef7b51152a59745befdd91d97091d2f' },
  RACA: { chain: 'bsc', address: '0x12bb890508c125661e03b09ec06e404bc9289040' },
  BSW: { chain: 'bsc', address: '0x965f527d9159dce6288a2219db51fc6eef120dd1' },
  BABY: { chain: 'bsc', address: '0x53e562b9b7e5e94b81f10e96ee70ad06df3d2657' },
  TWT: { chain: 'bsc', address: '0x4b0f1812e5df2a09796481ff14017e6005508003' },
  SFP: { chain: 'bsc', address: '0xd41fdb03ba84762dd66a0af1a6c8540ff1ba5dfb' },
  LINA: { chain: 'bsc', address: '0x762539b45a1dcce3d36d080f74d1aed37844b878' },
  // Solana tokens
  WIF: { chain: 'solana', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  BONK: { chain: 'solana', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  JTO: { chain: 'solana', address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL' },
  PYTH: { chain: 'solana', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3' },
  JUP: { chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  ORCA: { chain: 'solana', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE' },
  RAY: { chain: 'solana', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  POPCAT: { chain: 'solana', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  RENDER: { chain: 'solana', address: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof' },
  KMNO: { chain: 'solana', address: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS' },
  // Ethereum tokens
  PEPE: { chain: 'ethereum', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
  MOG: { chain: 'ethereum', address: '0xaaee1a9723aadb7afa2810263653a34ba2c21c7a' },
  TURBO: { chain: 'ethereum', address: '0xa35923162c49cf95e6bf26623385eb431ad920d3' },
  FLOKI: { chain: 'ethereum', address: '0xcf0c122c6b73ff809c693db761e7baebe62b6a2e' },
  SHIB: { chain: 'ethereum', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce' },
  APE: { chain: 'ethereum', address: '0x4d224452801aced8b2f0aebe155379bb5d594381' },
  LDO: { chain: 'ethereum', address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32' },
  UNI: { chain: 'ethereum', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' },
  AAVE: { chain: 'ethereum', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9' },
  ENS: { chain: 'ethereum', address: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72' },
};

// Get token logo - uses local icons first, then pre-configured URLs, then generated URLs
const getPoolLogo = (symbol: string): string => {
  // First check local static icons (for manually cached icons)
  if (LOCAL_TOKEN_ICONS[symbol]) {
    return LOCAL_TOKEN_ICONS[symbol];
  }
  // Check pre-configured DexScreener URLs (some tokens use CMS CDN, not standard token CDN)
  if (TOKEN_ICONS[symbol]) {
    return TOKEN_ICONS[symbol];
  }
  // Generate DexScreener CDN URL from token address
  const tokenInfo = TOKEN_ADDRESSES[symbol];
  if (tokenInfo) {
    return `https://dd.dexscreener.com/ds-data/tokens/${tokenInfo.chain}/${tokenInfo.address.toLowerCase()}.png`;
  }
  return '';
};

// Demo trending pools data - using local icons where available
const ALL_POOLS = [
  // Base pools (10)
  {
    rank: 1, symbol: 'PING', name: 'Ping', pair: 'PING/USDC', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x98c8f03094a9e65ccedc14c40130e4a5dd0ce14fb12ea58cbeac11f662b458b9',
    logo: getPoolLogo('PING'), dex: 'uniswap', version: 'V4',
    price: 0.008356, change24h: 12.5, volume24h: 8500000, liquidity: 2800000, mcap: 52000000, liquidityRatio: 5.4,
  },
  {
    rank: 2, symbol: 'DEGEN', name: 'Degen', pair: 'DEGEN/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa',
    logo: getPoolLogo('DEGEN'), dex: 'uniswap', version: 'V3',
    price: 0.0089, change24h: -5.2, volume24h: 12300000, liquidity: 8900000, mcap: 890000000, liquidityRatio: 1.0,
  },
  {
    rank: 3, symbol: 'BRETT', name: 'Brett', pair: 'BRETT/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8',
    logo: getPoolLogo('BRETT'), dex: 'uniswap', version: 'V3',
    price: 0.156, change24h: 8.7, volume24h: 9800000, liquidity: 15200000, mcap: 1500000000, liquidityRatio: 1.01,
  },
  {
    rank: 4, symbol: 'TOSHI', name: 'Toshi', pair: 'TOSHI/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('TOSHI'), dex: 'uniswap', version: 'V3',
    price: 0.00032, change24h: 15.3, volume24h: 4500000, liquidity: 3200000, mcap: 320000000, liquidityRatio: 1.0,
  },
  {
    rank: 5, symbol: 'AERO', name: 'Aerodrome', pair: 'AERO/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('AERO'), dex: 'aerodrome', version: 'V2',
    price: 1.25, change24h: 3.2, volume24h: 18000000, liquidity: 45000000, mcap: 750000000, liquidityRatio: 6.0,
  },
  {
    rank: 6, symbol: 'VIRTUAL', name: 'Virtual Protocol', pair: 'VIRTUAL/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('VIRTUAL'), dex: 'uniswap', version: 'V3',
    price: 2.85, change24h: 12.4, volume24h: 25000000, liquidity: 18000000, mcap: 2800000000, liquidityRatio: 0.64,
  },
  {
    rank: 7, symbol: 'WELL', name: 'Moonwell', pair: 'WELL/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('WELL'), dex: 'uniswap', version: 'V3',
    price: 0.045, change24h: -2.8, volume24h: 3200000, liquidity: 8500000, mcap: 180000000, liquidityRatio: 4.7,
  },
  {
    rank: 8, symbol: 'EXTRA', name: 'Extra Finance', pair: 'EXTRA/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('EXTRA'), dex: 'uniswap', version: 'V3',
    price: 0.12, change24h: 5.6, volume24h: 1800000, liquidity: 4200000, mcap: 45000000, liquidityRatio: 9.3,
  },
  {
    rank: 9, symbol: 'BALD', name: 'Bald', pair: 'BALD/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('BALD'), dex: 'uniswap', version: 'V2',
    price: 0.0023, change24h: -12.5, volume24h: 850000, liquidity: 1200000, mcap: 23000000, liquidityRatio: 5.2,
  },
  {
    rank: 10, symbol: 'BASED', name: 'Based', pair: 'BASED/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getPoolLogo('BASED'), dex: 'uniswap', version: 'V2',
    price: 0.00089, change24h: 3.4, volume24h: 620000, liquidity: 980000, mcap: 8900000, liquidityRatio: 11.0,
  },
  // BSC pools (10)
  {
    rank: 1, symbol: 'CAKE', name: 'PancakeSwap', pair: 'CAKE/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('CAKE'), dex: 'pancakeswap', version: 'V3',
    price: 2.45, change24h: 2.1, volume24h: 45000000, liquidity: 120000000, mcap: 680000000, liquidityRatio: 17.6,
  },
  {
    rank: 2, symbol: 'BAKE', name: 'BakerySwap', pair: 'BAKE/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('BAKE'), dex: 'pancakeswap', version: 'V2',
    price: 0.18, change24h: -3.5, volume24h: 2300000, liquidity: 4500000, mcap: 45000000, liquidityRatio: 10.0,
  },
  {
    rank: 3, symbol: 'XVS', name: 'Venus', pair: 'XVS/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('XVS'), dex: 'pancakeswap', version: 'V3',
    price: 8.90, change24h: 5.8, volume24h: 8900000, liquidity: 25000000, mcap: 130000000, liquidityRatio: 19.2,
  },
  {
    rank: 4, symbol: 'ALPACA', name: 'Alpaca Finance', pair: 'ALPACA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('ALPACA'), dex: 'pancakeswap', version: 'V2',
    price: 0.15, change24h: -1.2, volume24h: 1200000, liquidity: 3800000, mcap: 28000000, liquidityRatio: 13.6,
  },
  {
    rank: 5, symbol: 'RACA', name: 'Radio Caca', pair: 'RACA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('RACA'), dex: 'pancakeswap', version: 'V2',
    price: 0.00012, change24h: 8.5, volume24h: 5600000, liquidity: 8200000, mcap: 52000000, liquidityRatio: 15.8,
  },
  {
    rank: 6, symbol: 'BSW', name: 'Biswap', pair: 'BSW/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('BSW'), dex: 'biswap', version: 'V2',
    price: 0.065, change24h: -4.2, volume24h: 3400000, liquidity: 9800000, mcap: 42000000, liquidityRatio: 23.3,
  },
  {
    rank: 7, symbol: 'BABY', name: 'BabySwap', pair: 'BABY/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('BABY'), dex: 'babyswap', version: 'V2',
    price: 0.00045, change24h: 2.8, volume24h: 890000, liquidity: 2100000, mcap: 9500000, liquidityRatio: 22.1,
  },
  {
    rank: 8, symbol: 'TWT', name: 'Trust Wallet', pair: 'TWT/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('TWT'), dex: 'pancakeswap', version: 'V3',
    price: 1.15, change24h: 1.5, volume24h: 12000000, liquidity: 35000000, mcap: 480000000, liquidityRatio: 7.3,
  },
  {
    rank: 9, symbol: 'SFP', name: 'SafePal', pair: 'SFP/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('SFP'), dex: 'pancakeswap', version: 'V2',
    price: 0.72, change24h: -0.8, volume24h: 4500000, liquidity: 15000000, mcap: 360000000, liquidityRatio: 4.2,
  },
  {
    rank: 10, symbol: 'LINA', name: 'Linear', pair: 'LINA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getPoolLogo('LINA'), dex: 'pancakeswap', version: 'V2',
    price: 0.0085, change24h: 6.2, volume24h: 2800000, liquidity: 6500000, mcap: 48000000, liquidityRatio: 13.5,
  },
  // Solana pools (10)
  {
    rank: 1, symbol: 'WIF', name: 'dogwifhat', pair: 'WIF/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('WIF'), dex: 'raydium', version: 'CLMM',
    price: 2.34, change24h: -2.1, volume24h: 32000000, liquidity: 18000000, mcap: 2300000000, liquidityRatio: 0.78,
  },
  {
    rank: 2, symbol: 'BONK', name: 'Bonk', pair: 'BONK/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('BONK'), dex: 'raydium', version: 'CLMM',
    price: 0.0000234, change24h: 4.2, volume24h: 28000000, liquidity: 12000000, mcap: 1800000000, liquidityRatio: 0.67,
  },
  {
    rank: 3, symbol: 'JTO', name: 'Jito', pair: 'JTO/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('JTO'), dex: 'orca', version: 'CLMM',
    price: 3.45, change24h: 8.9, volume24h: 45000000, liquidity: 35000000, mcap: 420000000, liquidityRatio: 8.3,
  },
  {
    rank: 4, symbol: 'PYTH', name: 'Pyth Network', pair: 'PYTH/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('PYTH'), dex: 'orca', version: 'CLMM',
    price: 0.38, change24h: 1.5, volume24h: 22000000, liquidity: 28000000, mcap: 1400000000, liquidityRatio: 2.0,
  },
  {
    rank: 5, symbol: 'JUP', name: 'Jupiter', pair: 'JUP/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('JUP'), dex: 'meteora', version: 'DLMM',
    price: 0.92, change24h: 3.8, volume24h: 85000000, liquidity: 65000000, mcap: 1250000000, liquidityRatio: 5.2,
  },
  {
    rank: 6, symbol: 'ORCA', name: 'Orca', pair: 'ORCA/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('ORCA'), dex: 'orca', version: 'CLMM',
    price: 4.25, change24h: 5.2, volume24h: 12000000, liquidity: 22000000, mcap: 280000000, liquidityRatio: 7.9,
  },
  {
    rank: 7, symbol: 'RAY', name: 'Raydium', pair: 'RAY/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('RAY'), dex: 'raydium', version: 'CLMM',
    price: 5.80, change24h: -1.8, volume24h: 35000000, liquidity: 48000000, mcap: 850000000, liquidityRatio: 5.6,
  },
  {
    rank: 8, symbol: 'POPCAT', name: 'Popcat', pair: 'POPCAT/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('POPCAT'), dex: 'raydium', version: 'AMM',
    price: 0.85, change24h: 18.5, volume24h: 42000000, liquidity: 15000000, mcap: 830000000, liquidityRatio: 1.8,
  },
  {
    rank: 9, symbol: 'RENDER', name: 'Render', pair: 'RENDER/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('RENDER'), dex: 'orca', version: 'CLMM',
    price: 7.25, change24h: 2.4, volume24h: 28000000, liquidity: 42000000, mcap: 2800000000, liquidityRatio: 1.5,
  },
  {
    rank: 10, symbol: 'KMNO', name: 'Kamino', pair: 'KMNO/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getPoolLogo('KMNO'), dex: 'orca', version: 'CLMM',
    price: 0.12, change24h: -3.5, volume24h: 8500000, liquidity: 18000000, mcap: 120000000, liquidityRatio: 15.0,
  },
  // Ethereum pools (10)
  {
    rank: 1, symbol: 'PEPE', name: 'Pepe', pair: 'PEPE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
    logo: getPoolLogo('PEPE'), dex: 'uniswap', version: 'V3',
    price: 0.00001234, change24h: 12.5, volume24h: 45600000, liquidity: 28500000, mcap: 5200000000, liquidityRatio: 0.55,
  },
  {
    rank: 2, symbol: 'MOG', name: 'Mog Coin', pair: 'MOG/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('MOG'), dex: 'uniswap', version: 'V3',
    price: 0.0000021, change24h: 25.3, volume24h: 8200000, liquidity: 4500000, mcap: 850000000, liquidityRatio: 0.53,
  },
  {
    rank: 3, symbol: 'TURBO', name: 'Turbo', pair: 'TURBO/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('TURBO'), dex: 'uniswap', version: 'V2',
    price: 0.0067, change24h: -8.4, volume24h: 5600000, liquidity: 3200000, mcap: 420000000, liquidityRatio: 0.76,
  },
  {
    rank: 4, symbol: 'FLOKI', name: 'Floki', pair: 'FLOKI/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('FLOKI'), dex: 'uniswap', version: 'V2',
    price: 0.00017, change24h: 6.8, volume24h: 18000000, liquidity: 9500000, mcap: 1600000000, liquidityRatio: 0.59,
  },
  {
    rank: 5, symbol: 'SHIB', name: 'Shiba Inu', pair: 'SHIB/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('SHIB'), dex: 'uniswap', version: 'V3',
    price: 0.0000245, change24h: 3.2, volume24h: 125000000, liquidity: 85000000, mcap: 14500000000, liquidityRatio: 0.59,
  },
  {
    rank: 6, symbol: 'APE', name: 'ApeCoin', pair: 'APE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('APE'), dex: 'uniswap', version: 'V3',
    price: 1.45, change24h: -2.1, volume24h: 42000000, liquidity: 35000000, mcap: 870000000, liquidityRatio: 4.0,
  },
  {
    rank: 7, symbol: 'LDO', name: 'Lido DAO', pair: 'LDO/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('LDO'), dex: 'uniswap', version: 'V3',
    price: 2.15, change24h: 1.8, volume24h: 65000000, liquidity: 120000000, mcap: 1920000000, liquidityRatio: 6.25,
  },
  {
    rank: 8, symbol: 'UNI', name: 'Uniswap', pair: 'UNI/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('UNI'), dex: 'uniswap', version: 'V3',
    price: 12.50, change24h: 4.5, volume24h: 180000000, liquidity: 250000000, mcap: 7500000000, liquidityRatio: 3.33,
  },
  {
    rank: 9, symbol: 'AAVE', name: 'Aave', pair: 'AAVE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('AAVE'), dex: 'uniswap', version: 'V3',
    price: 285, change24h: 2.8, volume24h: 95000000, liquidity: 180000000, mcap: 4200000000, liquidityRatio: 4.29,
  },
  {
    rank: 10, symbol: 'ENS', name: 'ENS', pair: 'ENS/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getPoolLogo('ENS'), dex: 'uniswap', version: 'V3',
    price: 28.50, change24h: -1.2, volume24h: 32000000, liquidity: 65000000, mcap: 850000000, liquidityRatio: 7.65,
  },
];

const STATS = {
  totalLiquidity: 2400000000,
  poolsTracked: 12500,
  chains: 6,
  volume24h: 890000000,
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [selectedChain, setSelectedChain] = useState('base');
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0b0b0e]" />;
  }

  const filteredPools = ALL_POOLS.filter(pool => pool.chain === selectedChain);

  return (
    <div className="min-h-screen bg-[#0b0b0e] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-8" />
          </Link>
          <nav className="flex items-center gap-4">
            <a
              href="https://github.com/V4nus/0xArgus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm hidden sm:block"
            >
              GitHub
            </a>
            <a
              href="https://x.com/0xArgus_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm hidden sm:block"
            >
              Twitter
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero - Compact */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t.home.depthScanner}
          </h1>
          <p className="text-gray-500 mb-6">
            {t.home.heroSubtitle}
          </p>
          <div className="max-w-2xl">
            <SearchBox />
          </div>
          {/* Quick Access Tokens */}
          <QuickAccessTokens />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Droplets size={18} />}
            label={t.home.totalLiquidity}
            value={`$${formatNumber(STATS.totalLiquidity)}`}
          />
          <StatCard
            icon={<BarChart3 size={18} />}
            label={t.home.volume24h}
            value={`$${formatNumber(STATS.volume24h)}`}
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label={t.home.poolsTracked}
            value={formatNumber(STATS.poolsTracked)}
          />
          <StatCard
            icon={<RefreshCw size={18} />}
            label={t.home.chains}
            value={STATS.chains.toString()}
          />
        </div>

        {/* Trending Pools Table */}
        <div className="bg-[#111114] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold">{t.home.trendingPools}</h2>

            {/* Chain Selector */}
            <div className="flex items-center gap-2">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedChain === chain.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <img
                    src={chain.logo}
                    alt={chain.label}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="hidden sm:inline">{chain.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 text-xs text-gray-500 border-b border-white/5">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Pool</div>
            <div className="col-span-2 text-right">{t.common.price}</div>
            <div className="col-span-1 text-right">24h</div>
            <div className="col-span-2 text-right">{t.home.volume24h}</div>
            <div className="col-span-2 text-right">{t.common.liquidity}</div>
            <div className="col-span-1 text-right">{t.home.depth}</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {filteredPools.map((pool, index) => (
              <PoolRow key={`${pool.chain}-${pool.symbol}`} pool={{...pool, rank: index + 1}} t={t} />
            ))}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>{t.home.exploreRealPools}</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-gray-600 text-sm">
          0xArgus - DeFi Liquidity Analytics
        </div>
      </footer>
    </div>
  );
}

// Quick access tokens - popular tokens for fast navigation
const QUICK_ACCESS_TOKENS = [
  { symbol: 'DEGEN', chain: 'base', address: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed' },
  { symbol: 'BRETT', chain: 'base', address: '0x532f27101965dd16442e59d40670faf5ebb142e4' },
  { symbol: 'PEPE', chain: 'ethereum', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933' },
  { symbol: 'WIF', chain: 'solana', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'BONK', chain: 'solana', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'JUP', chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'AERO', chain: 'base', address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631' },
  { symbol: 'CAKE', chain: 'bsc', address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82' },
];

function QuickAccessTokens() {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500 mr-1">Quick:</span>
      {QUICK_ACCESS_TOKENS.map((token) => (
        <Link
          key={`${token.chain}-${token.symbol}`}
          href={`/token/${token.chain}/${token.address}`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm"
        >
          {LOCAL_TOKEN_ICONS[token.symbol] ? (
            <img
              src={LOCAL_TOKEN_ICONS[token.symbol]}
              alt={token.symbol}
              className="w-4 h-4 rounded-full"
            />
          ) : (
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[8px] font-bold">
              {token.symbol[0]}
            </div>
          )}
          <span className="text-gray-300">{token.symbol}</span>
        </Link>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#111114] rounded-lg border border-white/5 p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function PoolRow({ pool, t }: { pool: typeof ALL_POOLS[0]; t: ReturnType<typeof useTranslations> }) {
  const [imgSrc, setImgSrc] = useState(pool.logo || '');
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(!pool.logo);
  const isPositive = pool.change24h >= 0;
  const depthColor = pool.liquidityRatio >= 1 ? '#22c55e' : pool.liquidityRatio >= 0.7 ? '#eab308' : '#ef4444';
  const depthLabel = pool.liquidityRatio >= 1 ? t.home.deep : pool.liquidityRatio >= 0.7 ? t.home.medium : t.home.shallow;

  // Generate link: prefer pool address, fallback to token search
  const tokenInfo = TOKEN_ADDRESSES[pool.symbol];
  const href = pool.poolAddress !== '0x0'
    ? `/pool/${pool.chain}/${pool.poolAddress}`
    : tokenInfo
      ? `/token/${tokenInfo.chain}/${tokenInfo.address}`
      : undefined;

  // Handle image error - try fallback sources
  const handleImageError = () => {
    const fallbacks = getFallbackIcons(pool.symbol);
    if (fallbackIndex < fallbacks.length) {
      setImgSrc(fallbacks[fallbackIndex]);
      setFallbackIndex(prev => prev + 1);
    } else {
      // All fallbacks failed, show initial fallback
      setShowFallback(true);
    }
  };

  const content = (
    <>
      {/* Rank */}
      <div className="col-span-2 sm:col-span-1 text-gray-500 font-mono text-sm">
        {pool.rank}
      </div>

      {/* Pool Info */}
      <div className="col-span-10 sm:col-span-3 flex items-center gap-3">
        {!showFallback && imgSrc ? (
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#21262d] flex-shrink-0">
            <img
              src={imgSrc}
              alt={pool.symbol}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {pool.symbol[0]}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{pool.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
              {pool.chainLabel}
            </span>
            {pool.version && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#58a6ff]/10 text-[#58a6ff]">
                {pool.version}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">{pool.pair}</div>
        </div>
      </div>

      {/* Mobile: Show key stats in 2 columns */}
      <div className="col-span-6 sm:hidden text-xs text-gray-500 mt-2">
        <div className="flex justify-between">
          <span>{t.common.price}:</span>
          <span className="text-white font-mono">${formatPrice(pool.price)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>{t.common.liquidity}:</span>
          <span className="text-white">${formatNumber(pool.liquidity)}</span>
        </div>
      </div>
      <div className="col-span-6 sm:hidden text-xs mt-2">
        <div className="flex justify-between">
          <span className="text-gray-500">24h:</span>
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            {isPositive ? '+' : ''}{pool.change24h.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-gray-500">{t.home.depth}:</span>
          <span style={{ color: depthColor }}>{depthLabel}</span>
        </div>
      </div>

      {/* Desktop columns */}
      <div className="hidden sm:block sm:col-span-2 text-right font-mono text-sm">
        ${formatPrice(pool.price)}
      </div>

      <div className={`hidden sm:flex sm:col-span-1 justify-end items-center gap-1 text-sm ${
        isPositive ? 'text-green-500' : 'text-red-500'
      }`}>
        {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {Math.abs(pool.change24h).toFixed(1)}%
      </div>

      <div className="hidden sm:block sm:col-span-2 text-right text-sm text-gray-300">
        ${formatNumber(pool.volume24h)}
      </div>

      <div className="hidden sm:block sm:col-span-2 text-right text-sm text-gray-300">
        ${formatNumber(pool.liquidity)}
      </div>

      <div className="hidden sm:flex sm:col-span-1 justify-end">
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            backgroundColor: `${depthColor}15`,
            color: depthColor
          }}
        >
          {depthLabel}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors items-center cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors items-center opacity-60">
      {content}
    </div>
  );
}

// formatNumber and formatPrice imported from @/lib/api
