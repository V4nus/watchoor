'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowUp, ArrowDown, TrendingUp, Droplets, BarChart3, RefreshCw } from 'lucide-react';

// Demo trending pools data
const TRENDING_POOLS = [
  {
    rank: 1,
    symbol: 'PEPE',
    name: 'Pepe',
    pair: 'PEPE/WETH',
    chain: 'ethereum',
    chainLabel: 'ETH',
    poolAddress: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
    price: 0.00001234,
    change24h: 12.5,
    volume24h: 45600000,
    liquidity: 28500000,
    mcap: 5200000000,
    liquidityRatio: 0.55,
  },
  {
    rank: 2,
    symbol: 'DEGEN',
    name: 'Degen',
    pair: 'DEGEN/WETH',
    chain: 'base',
    chainLabel: 'Base',
    poolAddress: '0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa',
    price: 0.0089,
    change24h: -5.2,
    volume24h: 12300000,
    liquidity: 8900000,
    mcap: 890000000,
    liquidityRatio: 1.0,
  },
  {
    rank: 3,
    symbol: 'BRETT',
    name: 'Brett',
    pair: 'BRETT/WETH',
    chain: 'base',
    chainLabel: 'Base',
    poolAddress: '0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8',
    price: 0.156,
    change24h: 8.7,
    volume24h: 9800000,
    liquidity: 15200000,
    mcap: 1500000000,
    liquidityRatio: 1.01,
  },
  {
    rank: 4,
    symbol: 'MOG',
    name: 'Mog Coin',
    pair: 'MOG/WETH',
    chain: 'ethereum',
    chainLabel: 'ETH',
    poolAddress: '0x0',
    price: 0.0000021,
    change24h: 25.3,
    volume24h: 8200000,
    liquidity: 4500000,
    mcap: 850000000,
    liquidityRatio: 0.53,
  },
  {
    rank: 5,
    symbol: 'WIF',
    name: 'dogwifhat',
    pair: 'WIF/SOL',
    chain: 'solana',
    chainLabel: 'SOL',
    poolAddress: '0x0',
    price: 2.34,
    change24h: -2.1,
    volume24h: 32000000,
    liquidity: 18000000,
    mcap: 2300000000,
    liquidityRatio: 0.78,
  },
  {
    rank: 6,
    symbol: 'BONK',
    name: 'Bonk',
    pair: 'BONK/SOL',
    chain: 'solana',
    chainLabel: 'SOL',
    poolAddress: '0x0',
    price: 0.0000234,
    change24h: 4.2,
    volume24h: 28000000,
    liquidity: 12000000,
    mcap: 1800000000,
    liquidityRatio: 0.67,
  },
  {
    rank: 7,
    symbol: 'TURBO',
    name: 'Turbo',
    pair: 'TURBO/WETH',
    chain: 'ethereum',
    chainLabel: 'ETH',
    poolAddress: '0x0',
    price: 0.0067,
    change24h: -8.4,
    volume24h: 5600000,
    liquidity: 3200000,
    mcap: 420000000,
    liquidityRatio: 0.76,
  },
  {
    rank: 8,
    symbol: 'FLOKI',
    name: 'Floki',
    pair: 'FLOKI/WETH',
    chain: 'ethereum',
    chainLabel: 'ETH',
    poolAddress: '0x0',
    price: 0.00017,
    change24h: 6.8,
    volume24h: 18000000,
    liquidity: 9500000,
    mcap: 1600000000,
    liquidityRatio: 0.59,
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

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0b0b0e]" />;
  }

  return (
    <div className="min-h-screen bg-[#0b0b0e] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-6" />
          </Link>
          <nav className="flex items-center gap-3">
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
            Liquidity Depth Scanner
          </h1>
          <p className="text-gray-500 mb-6">
            See the real trading capacity behind every token
          </p>
          <div className="max-w-2xl">
            <SearchBox />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Droplets size={18} />}
            label="Total Liquidity"
            value={`$${formatNumber(STATS.totalLiquidity)}`}
          />
          <StatCard
            icon={<BarChart3 size={18} />}
            label="24h Volume"
            value={`$${formatNumber(STATS.volume24h)}`}
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label="Pools Tracked"
            value={formatNumber(STATS.poolsTracked)}
          />
          <StatCard
            icon={<RefreshCw size={18} />}
            label="Chains"
            value={STATS.chains.toString()}
          />
        </div>

        {/* Trending Pools Table */}
        <div className="bg-[#111114] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold">Trending Pools</h2>
            <span className="text-xs text-gray-500">Updated live</span>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 text-xs text-gray-500 border-b border-white/5">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Pool</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1 text-right">24h</div>
            <div className="col-span-2 text-right">Volume 24h</div>
            <div className="col-span-2 text-right">Liquidity</div>
            <div className="col-span-1 text-right">Depth</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {TRENDING_POOLS.map((pool) => (
              <PoolRow key={pool.rank} pool={pool} />
            ))}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>Search any token to analyze its liquidity depth</p>
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

function PoolRow({ pool }: { pool: typeof TRENDING_POOLS[0] }) {
  const isPositive = pool.change24h >= 0;
  const depthColor = pool.liquidityRatio >= 1 ? '#22c55e' : pool.liquidityRatio >= 0.7 ? '#eab308' : '#ef4444';
  const depthLabel = pool.liquidityRatio >= 1 ? 'Deep' : pool.liquidityRatio >= 0.7 ? 'Medium' : 'Shallow';

  const href = pool.poolAddress !== '0x0'
    ? `/pool/${pool.chain}/${pool.poolAddress}`
    : '#';

  return (
    <Link
      href={href}
      className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors items-center"
    >
      {/* Rank */}
      <div className="col-span-2 sm:col-span-1 text-gray-500 font-mono text-sm">
        {pool.rank}
      </div>

      {/* Pool Info */}
      <div className="col-span-10 sm:col-span-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
          {pool.symbol[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{pool.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
              {pool.chainLabel}
            </span>
          </div>
          <div className="text-xs text-gray-500 truncate">{pool.pair}</div>
        </div>
      </div>

      {/* Mobile: Show key stats in 2 columns */}
      <div className="col-span-6 sm:hidden text-xs text-gray-500 mt-2">
        <div className="flex justify-between">
          <span>Price:</span>
          <span className="text-white font-mono">${formatPrice(pool.price)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Liquidity:</span>
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
          <span className="text-gray-500">Depth:</span>
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
    </Link>
  );
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(0);
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.0001) return price.toFixed(6);
  if (price >= 0.0000001) return price.toFixed(8);
  return price.toExponential(2);
}
