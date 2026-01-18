'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Github,
  Twitter,
  ChevronDown,
  BookOpen,
  History,
  Star,
  Code2,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { getSearchHistory, SearchHistoryItem } from '@/lib/search-history';
import { getFavorites, FavoriteItem } from '@/lib/favorites';

// Chain logos
const CHAIN_LOGOS: Record<string, string> = {
  base: '/chains/base.svg',
  bsc: '/chains/bsc.svg',
  solana: '/chains/solana.png',
  ethereum: '/chains/ethereum.png',
};

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', logo: CHAIN_LOGOS.ethereum },
  { id: 'base', name: 'Base', logo: CHAIN_LOGOS.base },
  { id: 'bsc', name: 'BNB Chain', logo: CHAIN_LOGOS.bsc },
  { id: 'solana', name: 'Solana', logo: CHAIN_LOGOS.solana },
];

// Hot pool type from API
interface HotPool {
  symbol: string;
  pair: string;
  chain: string;
  poolAddress: string;
  logo: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [hotPools, setHotPools] = useState<HotPool[]>([]);

  useEffect(() => {
    setMounted(true);
    // Load search history and favorites from localStorage
    setSearchHistory(getSearchHistory());
    setFavorites(getFavorites());

    // Fetch hot/trending pools from API
    const fetchHotPools = async () => {
      try {
        // Fetch from multiple chains in parallel
        const chains = ['base', 'ethereum', 'solana'];
        const responses = await Promise.all(
          chains.map(chain =>
            fetch(`/api/trending?chain=${chain}`)
              .then(res => res.ok ? res.json() : { pools: [] })
              .catch(() => ({ pools: [] }))
          )
        );

        // Combine and take top pools from each chain
        const allPools: HotPool[] = [];
        responses.forEach((data, idx) => {
          const pools = (data.pools || []).slice(0, 2).map((p: { symbol: string; pair: string; poolAddress: string; logo: string }) => ({
            symbol: p.symbol,
            pair: p.pair,
            chain: chains[idx],
            poolAddress: p.poolAddress,
            logo: p.logo,
          }));
          allPools.push(...pools);
        });

        setHotPools(allPools.slice(0, 5)); // Max 5 hot pools
      } catch (err) {
        console.error('Failed to fetch hot pools:', err);
      }
    };

    fetchHotPools();
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-black" />;
  }

  // Pre-defined random heights and highlight positions
  const heights = [32, 58, 41, 73, 28, 65, 52, 38, 81, 45, 69, 34, 77, 49, 62, 36, 85, 43, 71, 29, 67, 54, 39, 79, 47, 63, 35, 82, 44, 68, 31, 75, 50, 61, 37, 83, 42, 70, 33, 78, 48, 64, 40, 72, 30, 66, 53, 80];
  const highlights = [3, 8, 14, 21, 27, 33, 39, 44];

  return (
    <>
      {/* Hero section flowing liquidity background - only for first screen */}
      <div className="absolute top-0 left-0 right-0 h-screen z-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-[2px]">
          {heights.map((height, i) => {
            const isHighlight = highlights.includes(i);
            const waveDelay = i * 0.1;

            return (
              <div
                key={`bg-${i}`}
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${height}vh`,
                  background: isHighlight
                    ? 'linear-gradient(to top, rgba(34, 197, 94, 0.18), rgba(34, 197, 94, 0.04))'
                    : 'linear-gradient(to top, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.01))',
                  boxShadow: isHighlight ? '0 0 20px rgba(34, 197, 94, 0.08)' : 'none',
                  animation: `liquidityFlow 3s ease-in-out ${waveDelay}s infinite`,
                  transformOrigin: 'bottom',
                }}
              />
            );
          })}
        </div>
        {/* Gradient fade to black at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen text-white">
        {/* Header - Minimal */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <path
                  d="M24 12C14 12 6 24 6 24C6 24 14 36 24 36C34 36 42 24 42 24C42 24 34 12 24 12Z"
                  stroke="#22c55e"
                  strokeWidth="2"
                  fill="none"
                />
                <circle cx="24" cy="24" r="8" stroke="#22c55e" strokeWidth="1.5" fill="none" />
                <circle cx="24" cy="24" r="4" fill="#22c55e" />
              </svg>
              <span className="text-lg font-medium tracking-wide">Watchoor</span>
            </Link>

            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
                <a href="#features" className="hover:text-white transition-colors">Features</a>
                <a href="#api" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Code2 size={14} />
                  API
                </a>
                <Link href="/wiki" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <BookOpen size={14} />
                  Wiki
                </Link>
              </nav>
              <div className="flex items-center gap-4">
                <a
                  href="https://github.com/V4nus/watchoor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <Github size={18} />
                </a>
                <a
                  href="https://x.com/watchoor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <Twitter size={18} />
                </a>
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section - Full screen, centered */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 relative snap-section">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#22c55e]/5 via-transparent to-transparent pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1a1a1a] bg-black/50 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-sm text-gray-400">Live on-chain data</span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium tracking-tight mb-6">
              See Before
              <br />
              You <span className="text-[#22c55e]">Trade</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12">
              See the depth. Trade with clarity.
            </p>

            {/* Search Box */}
            <div className="max-w-xl mx-auto mb-8">
              <SearchBox />
            </div>

            {/* Quick links - Show both hot tokens and history */}
            <div className="flex flex-col gap-3">
              {/* Hot tokens row */}
              {hotPools.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
                    <span className="text-orange-500">🔥</span>
                    Hot
                  </span>
                  {hotPools.map((pool) => (
                    <Link
                      key={`${pool.chain}-${pool.poolAddress}`}
                      href={`/pool/${pool.chain}/${pool.poolAddress}`}
                      className="px-4 py-2 rounded-full bg-[#111] hover:bg-[#1a1a1a] border border-[#222] text-sm text-gray-300 hover:text-white transition-all flex items-center gap-2"
                    >
                      {pool.logo && (
                        <img src={pool.logo} alt={pool.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      {pool.pair}
                      <img src={CHAIN_LOGOS[pool.chain]} alt="" className="w-4 h-4 opacity-60" />
                    </Link>
                  ))}
                </div>
              )}

              {/* Favorites row - only show if there are favorites */}
              {favorites.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
                    <Star size={12} className="text-yellow-400" fill="currentColor" />
                    Favorites
                  </span>
                  {favorites.slice(0, 4).map((item) => (
                    <Link
                      key={`fav-${item.chainId}-${item.poolAddress}`}
                      href={`/pool/${item.chainId}/${item.poolAddress}`}
                      className="px-4 py-2 rounded-full bg-[#111] hover:bg-[#1a1a1a] border border-[#222] text-sm text-gray-300 hover:text-white transition-all flex items-center gap-2"
                    >
                      {item.logo && (
                        <img src={item.logo} alt={item.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      {item.pair}
                      {item.chainLogo && (
                        <img src={item.chainLogo} alt="" className="w-4 h-4 opacity-60" />
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* Recent history row - only show if there's history */}
              {searchHistory.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 mr-1">
                    <History size={12} />
                    Recent
                  </span>
                  {searchHistory.slice(0, 4).map((item) => (
                    <Link
                      key={`${item.chainId}-${item.poolAddress}`}
                      href={`/pool/${item.chainId}/${item.poolAddress}`}
                      className="px-4 py-2 rounded-full bg-[#111] hover:bg-[#1a1a1a] border border-[#222] text-sm text-gray-300 hover:text-white transition-all flex items-center gap-2"
                    >
                      {item.logo && (
                        <img src={item.logo} alt={item.symbol} className="w-5 h-5 rounded-full" />
                      )}
                      {item.pair}
                      {item.chainLogo && (
                        <img src={item.chainLogo} alt="" className="w-4 h-4 opacity-60" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500">
            <span className="text-xs tracking-widest uppercase">Scroll</span>
            <ChevronDown size={20} className="animate-bounce" />
          </div>

          {/* Supported chains - bottom */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-[#111] py-4">
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-8">
              {SUPPORTED_CHAINS.map((chain) => (
                <div
                  key={chain.id}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <img src={chain.logo} alt={chain.name} className="w-5 h-5 opacity-60" />
                  <span className="text-sm hidden sm:inline">{chain.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Order Flow Section */}
        <OrderFlowSection />

        {/* API Products Section */}
        <APIProductsSection />

        {/* Features Section */}
        <section id="features" className="min-h-screen flex flex-col justify-center py-32 border-t border-[#111] snap-section">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-16 lg:gap-24">
              {/* Left - Title */}
              <div>
                <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">
                  Built for
                  <br />
                  <span className="text-[#22c55e]">Traders</span>
                </h2>
                <p className="text-gray-400 text-lg leading-relaxed">
                  Professional-grade liquidity analysis tools.
                  See exactly where the depth is before you trade.
                </p>
              </div>

              {/* Right - Feature list */}
              <div className="space-y-8">
                <FeatureItem
                  number="01"
                  title="Multi-Protocol Support"
                  description="V2, V3, and V4 AMM pools across Ethereum, Base, BSC, and Solana."
                />
                <FeatureItem
                  number="02"
                  title="Tick-Level Analysis"
                  description="Granular liquidity distribution at every price tick for precise trading."
                />
                <FeatureItem
                  number="03"
                  title="Real-Time Updates"
                  description="Live on-chain data with sub-second latency for accurate decisions."
                />
                <FeatureItem
                  number="04"
                  title="Depth Visualization"
                  description="Order book style depth charts showing bid/ask liquidity."
                />
              </div>
            </div>
          </div>
        </section>

        {/* Footer - Minimal */}
        <footer className="border-t border-[#111] py-12">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <svg width="24" height="24" viewBox="0 0 48 48" fill="none" className="opacity-50">
                  <path
                    d="M24 12C14 12 6 24 6 24C6 24 14 36 24 36C34 36 42 24 42 24C42 24 34 12 24 12Z"
                    stroke="#22c55e"
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle cx="24" cy="24" r="4" fill="#22c55e" />
                </svg>
                <span className="text-sm text-gray-500">Watchoor · DeFi Liquidity Analytics</span>
              </div>
              <div className="flex items-center gap-8 text-sm text-gray-500">
                <a
                  href="https://github.com/V4nus/watchoor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="https://x.com/watchoor"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Twitter
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        html {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .snap-section {
          scroll-snap-align: start;
          scroll-snap-stop: always;
        }
        * {
          scroll-behavior: smooth;
        }
        @keyframes liquidityFlow {
          0%, 100% {
            transform: scaleY(1);
            opacity: 1;
          }
          50% {
            transform: scaleY(0.85);
            opacity: 0.7;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

// Order Book Section with animated depth visualization
function OrderFlowSection() {
  const [orderBook, setOrderBook] = useState<{
    bids: Array<{ price: number; size: number; depth: number }>;
    asks: Array<{ price: number; size: number; depth: number }>;
  }>({ bids: [], asks: [] });

  const currentPrice = 2847.32;

  useEffect(() => {
    // Generate initial order book
    generateOrderBook();

    // Update periodically for animation
    const interval = setInterval(() => {
      generateOrderBook();
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  function generateOrderBook() {
    const bids: Array<{ price: number; size: number; depth: number }> = [];
    const asks: Array<{ price: number; size: number; depth: number }> = [];

    let bidDepth = 0;
    for (let i = 1; i <= 12; i++) {
      const size = 25000 + Math.random() * 200000;
      bidDepth += size;
      bids.push({
        price: currentPrice - i * 10 - Math.random() * 4,
        size,
        depth: bidDepth,
      });
    }

    let askDepth = 0;
    for (let i = 1; i <= 12; i++) {
      const size = 25000 + Math.random() * 200000;
      askDepth += size;
      asks.push({
        price: currentPrice + i * 10 + Math.random() * 4,
        size,
        depth: askDepth,
      });
    }

    setOrderBook({ bids, asks });
  }

  const maxDepth = Math.max(
    ...orderBook.bids.map(b => b.depth),
    ...orderBook.asks.map(a => a.depth),
    1
  );

  const formatK = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toFixed(0);
  };

  return (
    <section className="min-h-screen flex flex-col justify-center py-20 border-t border-[#111] overflow-hidden snap-section">
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        {/* Header row with title on left, price on right */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            {/* Left: Small label style title */}
            <div>
              <span className="text-xs uppercase tracking-widest text-[#22c55e] font-medium mb-2 block">Live Demo</span>
              <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
                Order Book Depth
              </h2>
              <p className="text-gray-500 text-sm mt-1">Bid/Ask liquidity visualization</p>
            </div>

            {/* Right: Current Price */}
            <div className="flex items-center gap-4 px-6 py-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
              <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight tabular-nums">${currentPrice.toFixed(2)}</div>
              <div className="text-left border-l border-[#222] pl-4">
                <div className="text-sm text-gray-400 font-medium">ETH/USDC</div>
                <div className="text-xs text-gray-600">Spread: 0.02%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Book - Full width with max constraint */}
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-4 lg:gap-8">
            {/* Bids (left) */}
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-3 px-3">
                <span className="uppercase tracking-wider font-medium text-[#22c55e]">Bids</span>
                <span>Total: ${formatK(orderBook.bids[orderBook.bids.length - 1]?.depth || 0)}</span>
              </div>
              <div className="space-y-[2px]">
                {orderBook.bids.map((order, i) => {
                  const widthPercent = (order.depth / maxDepth) * 100;
                  return (
                    <div
                      key={`bid-${i}`}
                      className="relative h-9 sm:h-10 flex items-center rounded overflow-hidden group hover:bg-[#22c55e]/5 transition-colors"
                    >
                      <div
                        className="absolute left-0 h-full bg-gradient-to-r from-[#22c55e]/30 to-[#22c55e]/5 transition-all duration-700"
                        style={{ width: `${widthPercent}%` }}
                      />
                      <div className="relative flex justify-between w-full px-3 font-mono text-sm">
                        <span className="text-[#22c55e] font-medium">${order.price.toFixed(2)}</span>
                        <span className="text-gray-400 tabular-nums">{formatK(order.size)}</span>
                        <span className="text-gray-600 tabular-nums hidden sm:block">{formatK(order.depth)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Center divider with pulse effect */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <div className="w-px h-full bg-gradient-to-b from-transparent via-[#22c55e]/20 to-transparent relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              </div>
            </div>

            {/* Asks (right) */}
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-3 px-3">
                <span className="uppercase tracking-wider font-medium text-red-400">Asks</span>
                <span>Total: ${formatK(orderBook.asks[orderBook.asks.length - 1]?.depth || 0)}</span>
              </div>
              <div className="space-y-[2px]">
                {orderBook.asks.map((order, i) => {
                  const widthPercent = (order.depth / maxDepth) * 100;
                  return (
                    <div
                      key={`ask-${i}`}
                      className="relative h-9 sm:h-10 flex items-center rounded overflow-hidden group hover:bg-red-500/5 transition-colors"
                    >
                      <div
                        className="absolute right-0 h-full bg-gradient-to-l from-red-500/30 to-red-500/5 transition-all duration-700"
                        style={{ width: `${widthPercent}%` }}
                      />
                      <div className="relative flex justify-between w-full px-3 font-mono text-sm">
                        <span className="text-gray-600 tabular-nums hidden sm:block">{formatK(order.depth)}</span>
                        <span className="text-gray-400 tabular-nums">{formatK(order.size)}</span>
                        <span className="text-red-400 font-medium">${order.price.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Legend - smaller and more subtle */}
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mt-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]/50" />
              <span>Buy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/50" />
              <span>Sell</span>
            </div>
            <span className="text-gray-600">Price · Size · Depth</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// API Products Section
function APIProductsSection() {
  const apis = [
    {
      id: 'orderbook',
      name: 'Order Book API',
      description: 'Real-time bid/ask liquidity depth data for any supported pool.',
      price: '$0.01',
      endpoint: '/api/x402/orderbook',
    },
    {
      id: 'liquidity-depth',
      name: 'Liquidity Depth API',
      description: 'Cumulative liquidity curves with price impact analysis.',
      price: '$0.02',
      endpoint: '/api/x402/liquidity-depth',
    }
  ];

  return (
    <section id="api" className="min-h-screen flex flex-col justify-center py-24 border-t border-[#111] snap-section">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/5 mb-6">
            <Code2 size={16} className="text-[#22c55e]" />
            <span className="text-sm text-[#22c55e]">x402 Protocol</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-4">
            Liquidity Data <span className="text-[#22c55e]">API</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Pay-per-request APIs powered by x402. Built for AI agents.
            No subscriptions, no API keys.
          </p>
        </div>

        {/* API Cards */}
        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          {apis.map((api) => (
            <Link
              key={api.id}
              href="/x402"
              className="group relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 hover:border-[#22c55e]/30 transition-all duration-300"
            >
              {/* Price badge */}
              <div className="absolute top-6 right-6">
                <div className="px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
                  <span className="text-[#22c55e] font-mono text-sm font-medium">{api.price}</span>
                  <span className="text-gray-500 text-xs ml-1">/req</span>
                </div>
              </div>

              {/* Content */}
              <h3 className="text-xl font-medium mb-2 pr-24">{api.name}</h3>
              <p className="text-gray-400 text-sm mb-4 leading-relaxed">{api.description}</p>

              {/* Endpoint */}
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-3">
                <code className="text-sm text-[#22c55e] font-mono break-all">{api.endpoint}</code>
              </div>

              {/* Hover indicator */}
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight size={20} className="text-[#22c55e]" />
              </div>
            </Link>
          ))}
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-6 mb-12">
          <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="p-2 rounded-lg bg-[#22c55e]/10">
              <Zap size={20} className="text-[#22c55e]" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Instant Access</h4>
              <p className="text-sm text-gray-500">No signup required. Pay with USDC on Base.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="p-2 rounded-lg bg-[#22c55e]/10">
              <Shield size={20} className="text-[#22c55e]" />
            </div>
            <div>
              <h4 className="font-medium mb-1">No API Keys</h4>
              <p className="text-sm text-gray-500">Your payment is your access token.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
            <div className="p-2 rounded-lg bg-[#22c55e]/10">
              <Code2 size={20} className="text-[#22c55e]" />
            </div>
            <div>
              <h4 className="font-medium mb-1">AI-Ready</h4>
              <p className="text-sm text-gray-500">Built for autonomous agent payments.</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/x402"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#22c55e] hover:bg-[#1ea84b] text-black font-medium transition-colors"
          >
            View API Documentation
            <ArrowRight size={18} />
          </Link>
          <p className="text-xs text-gray-500 mt-4">
            Powered by Coinbase x402 Protocol · Payments on Base Network
          </p>
        </div>
      </div>
    </section>
  );
}

// Feature Item Component
function FeatureItem({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 group">
      <span className="text-sm text-[#22c55e] font-mono">{number}</span>
      <div>
        <h3 className="text-xl font-medium mb-2 group-hover:text-[#22c55e] transition-colors">{title}</h3>
        <p className="text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
