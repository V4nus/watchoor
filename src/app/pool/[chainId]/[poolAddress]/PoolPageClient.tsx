'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PoolInfo } from '@/types';
import { formatNumber, formatPercentage } from '@/lib/api';
import { ArrowLeft, ExternalLink, Copy, Check, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import FavoritesSidebar from '@/components/FavoritesSidebar';

// Dynamic imports for client components
const Chart = dynamic(() => import('@/components/Chart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
      <div className="text-gray-400 animate-pulse">Loading chart...</div>
    </div>
  ),
});

const RealtimePrice = dynamic(() => import('@/components/RealtimePrice'), {
  ssr: false,
});

const LiquidityDepth = dynamic(() => import('@/components/LiquidityDepth'), {
  ssr: false,
  loading: () => (
    <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
      <div className="text-center text-gray-400 animate-pulse">Loading...</div>
    </div>
  ),
});

const LiquidityInfo = dynamic(() => import('@/components/LiquidityInfo'), {
  ssr: false,
});

const TradeHistory = dynamic(() => import('@/components/TradeHistory'), {
  ssr: false,
  loading: () => (
    <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
      <div className="text-center text-gray-400 animate-pulse">Loading trades...</div>
    </div>
  ),
});

interface PoolPageClientProps {
  pool: PoolInfo;
}

export default function PoolPageClient({ pool }: PoolPageClientProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const priceChangeColor = pool.priceChange24h >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';

  // Check if pool is favorited on mount
  useEffect(() => {
    setIsFav(isFavorite(pool.chainId, pool.poolAddress));

    const handleUpdate = () => {
      setIsFav(isFavorite(pool.chainId, pool.poolAddress));
    };
    window.addEventListener('favorites-updated', handleUpdate);
    return () => window.removeEventListener('favorites-updated', handleUpdate);
  }, [pool.chainId, pool.poolAddress]);

  const handleToggleFavorite = () => {
    const newState = toggleFavorite({
      chainId: pool.chainId,
      poolAddress: pool.poolAddress,
      baseSymbol: pool.baseToken.symbol,
      quoteSymbol: pool.quoteToken.symbol,
      baseImageUrl: pool.baseToken.imageUrl,
    });
    setIsFav(newState);
  };

  const explorerUrl = {
    base: 'https://basescan.org',
    ethereum: 'https://etherscan.io',
    bsc: 'https://bscscan.com',
    arbitrum: 'https://arbiscan.io',
    polygon: 'https://polygonscan.com',
    solana: 'https://solscan.io',
  }[pool.chainId] || 'https://etherscan.io';

  const copyAddress = async (address: string, label: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-screen flex bg-[#0d1117]">
      {/* Favorites Sidebar - embedded, hidden on mobile */}
      <div className="hidden md:block">
        <FavoritesSidebar
          currentPoolAddress={pool.poolAddress}
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Compact Header with real-time price */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Back + Token pair */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 hover:bg-[#30363d] rounded transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              <TokenPairLogos
                baseSymbol={pool.baseToken.symbol}
                quoteSymbol={pool.quoteToken.symbol}
                baseImageUrl={pool.baseToken.imageUrl}
                quoteImageUrl={pool.quoteToken.imageUrl}
                chainId={pool.chainId}
                size={28}
              />
              <h1 className="text-base sm:text-lg font-bold truncate">
                {pool.baseToken.symbol}/{pool.quoteToken.symbol}
              </h1>
              <span className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[#21262d] rounded text-gray-400">
                {pool.chainId.toUpperCase()}
              </span>
              <span className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[#21262d] rounded text-gray-400">
                {pool.dex}
              </span>
              {/* Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                className={`p-1.5 rounded transition-colors flex-shrink-0 ${
                  isFav
                    ? 'text-yellow-500 hover:bg-[#30363d]'
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-[#30363d]'
                }`}
                title={isFav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={18} className={isFav ? 'fill-yellow-500' : ''} />
              </button>
            </div>
          </div>

          {/* Center: Real-time price - hidden on very small screens */}
          <div className="hidden sm:flex flex-1 justify-center">
            <RealtimePrice
              chainId={pool.chainId}
              tokenAddress={pool.baseToken.address}
              initialPrice={pool.priceUsd}
              symbol={pool.baseToken.symbol}
            />
          </div>

          {/* Right: 24h change */}
          <div className={`text-xs sm:text-sm font-medium flex-shrink-0 ${priceChangeColor}`}>
            {formatPercentage(pool.priceChange24h)}
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-2 sm:px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          {/* Stats */}
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <StatItem label="Vol" value={`$${formatNumber(pool.volume24h)}`} />
            <StatItem label="Liq" value={`$${formatNumber(pool.liquidity)}`} />
            <StatItem label="Buys" value={pool.txns24h.buys.toString()} color="text-[#3fb950]" />
            <StatItem label="Sells" value={pool.txns24h.sells.toString()} color="text-[#f85149]" />
          </div>

          {/* Addresses - hidden on mobile */}
          <div className="hidden md:flex items-center gap-4 text-xs">
            <AddressChip
              label={pool.baseToken.symbol}
              address={pool.baseToken.address}
              explorerUrl={explorerUrl}
              copied={copied}
              onCopy={copyAddress}
            />
            <AddressChip
              label="Pool"
              address={pool.poolAddress}
              explorerUrl={explorerUrl}
              copied={copied}
              onCopy={copyAddress}
            />
          </div>
        </div>
      </div>

      {/* Main content: Chart + Liquidity + Info */}
      <main className="flex-1 p-2 flex flex-col md:flex-row gap-2 overflow-auto">
        {/* Left: Chart + LP Info stacked - scrollable */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Chart - responsive height: smaller on mobile, larger on desktop */}
          <div className="h-[300px] sm:h-[400px] md:h-[500px] bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden flex-shrink-0">
            <Chart
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              symbol={`${pool.baseToken.symbol}/${pool.quoteToken.symbol}`}
              baseTokenAddress={pool.baseToken.address}
            />
          </div>

          {/* LP Positions - full content, scroll to see all */}
          <div className="flex-shrink-0">
            <LiquidityInfo
              selectedLevel={null}
              currentPrice={pool.priceUsd}
              totalBidLiquidity={0}
              totalAskLiquidity={0}
              token0Symbol={pool.baseToken.symbol}
              token1Symbol={pool.quoteToken.symbol}
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              onClose={() => {}}
            />
          </div>
        </div>

        {/* Right: Order Book + Trade History - sticky on desktop, stacked on mobile */}
        <div className="flex flex-col sm:flex-row md:flex-row gap-2 flex-shrink-0 md:sticky md:top-0 md:self-start md:h-[calc(100vh-140px)]">
          {/* Order Book */}
          <div className="w-full sm:w-64 h-[300px] sm:h-[400px] md:h-full">
            <LiquidityDepth
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              priceUsd={pool.priceUsd}
              baseSymbol={pool.baseToken.symbol}
              quoteSymbol={pool.quoteToken.symbol}
              liquidityUsd={pool.liquidity}
              liquidityBase={pool.liquidityBase}
              liquidityQuote={pool.liquidityQuote}
              baseTokenAddress={pool.baseToken.address}
              quoteTokenAddress={pool.quoteToken.address}
            />
          </div>
          {/* Trade History */}
          <div className="w-full sm:w-72 h-[300px] sm:h-[400px] md:h-full">
            <TradeHistory
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              baseSymbol={pool.baseToken.symbol}
              priceUsd={pool.priceUsd}
            />
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400">{label}:</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

function AddressChip({
  label,
  address,
  explorerUrl,
  copied,
  onCopy,
}: {
  label: string;
  address: string;
  explorerUrl: string;
  copied: string | null;
  onCopy: (address: string, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[#0d1117] rounded">
      <span className="text-gray-400">{label}:</span>
      <code className="text-[#58a6ff]">
        {address.slice(0, 6)}...{address.slice(-4)}
      </code>
      <button
        onClick={() => onCopy(address, label)}
        className="p-0.5 hover:bg-[#30363d] rounded"
      >
        {copied === label ? (
          <Check size={12} className="text-[#3fb950]" />
        ) : (
          <Copy size={12} className="text-gray-400" />
        )}
      </button>
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-0.5 hover:bg-[#30363d] rounded"
      >
        <ExternalLink size={12} className="text-gray-400" />
      </a>
    </div>
  );
}
