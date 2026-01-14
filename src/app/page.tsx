'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import LiquidityShowcase from '@/components/LiquidityShowcase';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Github,
  Twitter,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

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

// Example pools for demo
const EXAMPLE_POOLS = [
  { symbol: 'DEGEN', chain: 'base', pair: 'DEGEN/WETH', address: '0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa' },
  { symbol: 'BRETT', chain: 'base', pair: 'BRETT/WETH', address: '0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8' },
  { symbol: 'PEPE', chain: 'ethereum', pair: 'PEPE/WETH', address: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-6" />
          </Link>
          <div className="flex items-center gap-4">
            <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors">
              <Github size={16} />
            </a>
            <a href="https://x.com/0xArgus_" target="_blank" rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors">
              <Twitter size={16} />
            </a>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Hero - Split layout */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Content */}
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-gray-500">Live on-chain data</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
                DEX Liquidity Scanner
              </h1>
              <p className="text-gray-400 text-sm mb-6 max-w-md">
                On-chain depth analysis for V2/V3/V4 AMM pools. Tick-level liquidity data, real-time.
              </p>

              {/* Search */}
              <div className="mb-4">
                <SearchBox />
              </div>

              {/* Quick links */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-600">Try:</span>
                {EXAMPLE_POOLS.map((pool) => (
                  <Link
                    key={pool.address}
                    href={`/pool/${pool.chain}/${pool.address}`}
                    className="px-2 py-1 rounded bg-[#151515] hover:bg-[#1a1a1a] border border-[#222] text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  >
                    {pool.pair}
                    <img src={CHAIN_LOGOS[pool.chain]} alt="" className="w-3 h-3 opacity-50" />
                  </Link>
                ))}
              </div>

              {/* Chains */}
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[#1a1a1a]">
                <span className="text-xs text-gray-600">Supported:</span>
                <div className="flex items-center gap-2">
                  {SUPPORTED_CHAINS.map((chain) => (
                    <div key={chain.id} className="w-6 h-6 rounded-full bg-[#151515] p-1" title={chain.name}>
                      <img src={chain.logo} alt={chain.name} className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Mini Demo */}
            <div className="lg:pt-8">
              <MiniOrderBook />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase - Scroll reveal */}
      <section className="py-16 border-t border-[#1a1a1a] bg-[#080808]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-10">
            <span className="text-xs text-green-500 uppercase tracking-wider">How it works</span>
            <h2 className="text-2xl font-bold mt-1">Tick-level liquidity from concentrated AMMs</h2>
          </div>
          <LiquidityShowcase />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-4 opacity-50" />
            <span>DeFi Liquidity Analytics</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors">GitHub</a>
            <a href="https://x.com/0xArgus_" target="_blank" rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Mini order book demo for hero section
function MiniOrderBook() {
  const [data, setData] = useState<{ price: number; size: number; side: 'bid' | 'ask' }[]>([]);

  useEffect(() => {
    const generateData = () => {
      const basePrice = 2847;
      const asks = Array.from({ length: 5 }, (_, i) => ({
        price: basePrice + (i + 1) * 14.2 + Math.random() * 5,
        size: 50000 + Math.random() * 200000,
        side: 'ask' as const,
      })).reverse();
      const bids = Array.from({ length: 5 }, (_, i) => ({
        price: basePrice - (i + 1) * 14.2 - Math.random() * 5,
        size: 50000 + Math.random() * 200000,
        side: 'bid' as const,
      }));
      return [...asks, ...bids];
    };

    setData(generateData());
    const interval = setInterval(() => setData(generateData()), 2000);
    return () => clearInterval(interval);
  }, []);

  const maxSize = Math.max(...data.map(d => d.size), 1);

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#627eea] flex items-center justify-center text-[8px] font-bold">Ξ</div>
          <span className="text-sm font-medium">ETH/USDC</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500">V3</span>
        </div>
        <span className="text-[10px] text-gray-500">Uniswap</span>
      </div>

      {/* Order book */}
      <div className="p-2">
        <div className="grid grid-cols-3 text-[10px] text-gray-500 px-2 mb-1">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">USD</span>
        </div>

        {data.map((row, i) => {
          const width = (row.size / maxSize) * 100;
          const isBid = row.side === 'bid';

          return (
            <div key={i} className="relative h-6 flex items-center text-[11px] font-mono">
              <div
                className={`absolute h-full ${isBid ? 'right-0 bg-green-500/10' : 'left-0 bg-red-500/10'}`}
                style={{ width: `${width}%` }}
              />
              <div className="relative grid grid-cols-3 w-full px-2">
                <span className={isBid ? 'text-green-500' : 'text-red-400'}>
                  {row.price.toFixed(2)}
                </span>
                <span className="text-right text-gray-400">
                  {(row.size / 1000).toFixed(1)}K
                </span>
                <span className="text-right text-gray-500">
                  ${(row.size / 1000).toFixed(0)}K
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-[#1a1a1a] text-[10px] text-gray-500 flex justify-between">
        <span>Real-time tick data</span>
        <span className="text-green-500">● Live</span>
      </div>
    </div>
  );
}
