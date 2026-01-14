'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PoolInfo } from '@/types';
import { formatNumber, formatPercentage } from '@/lib/api';
import { ArrowLeft, ExternalLink, Copy, Check, Globe, Twitter, MessageCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';
import { formatPrice } from '@/lib/api';

// Dynamic imports for client components
const Chart = dynamic(() => import('@/components/Chart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
      <div className="text-gray-400 animate-pulse">Loading chart...</div>
    </div>
  ),
});

const LiquidityDepth = dynamic(() => import('@/components/LiquidityDepth'), {
  ssr: false,
  loading: () => (
    <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
      <div className="text-center text-gray-400 animate-pulse">Loading...</div>
    </div>
  ),
});

const TradeHistory = dynamic(() => import('@/components/TradeHistory'), {
  ssr: false,
  loading: () => (
    <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
      <div className="text-center text-gray-400 animate-pulse">Loading trades...</div>
    </div>
  ),
});

const TradePanel = dynamic(() => import('@/components/TradePanel'), {
  ssr: false,
  loading: () => (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-3">
      <div className="text-center text-gray-400 animate-pulse">Loading...</div>
    </div>
  ),
});

const WalletButton = dynamic(() => import('@/components/WalletButton'), {
  ssr: false,
  loading: () => (
    <div className="px-3 py-1.5 bg-[#21262d] rounded animate-pulse w-24 h-8" />
  ),
});

interface PoolPageClientProps {
  pool: PoolInfo;
}

export default function PoolPageClient({ pool }: PoolPageClientProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [tradeEffect, setTradeEffect] = useState<'buy' | 'sell' | null>(null);
  const [mobileTab, setMobileTab] = useState<'chart' | 'orderbook' | 'trade'>('chart');
  const [deployerAddress, setDeployerAddress] = useState<string | null>(null);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number>(pool.priceUsd);
  const priceChangeColor = pool.priceChange24h >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';

  // Handle trade success - trigger chart beam effect
  const handleTradeSuccess = useCallback((tradeType: 'buy' | 'sell') => {
    setTradeEffect(tradeType);
  }, []);

  const handleTradeEffectComplete = useCallback(() => {
    setTradeEffect(null);
  }, []);

  // Handle price update from Chart component for Order Book sync
  const handlePriceUpdate = useCallback((price: number) => {
    setLivePrice(price);
  }, []);

  // Fetch deployer address and holders count
  useEffect(() => {
    const fetchTokenInfo = async () => {
      // Only fetch for EVM chains (not Solana)
      if (pool.chainId === 'solana') return;

      try {
        // Fetch contract creation info from block explorer API
        const explorerApiUrls: Record<string, string> = {
          base: 'https://api.basescan.org/api',
          ethereum: 'https://api.etherscan.io/api',
          bsc: 'https://api.bscscan.com/api',
          arbitrum: 'https://api.arbiscan.io/api',
          polygon: 'https://api.polygonscan.com/api',
        };

        const apiUrl = explorerApiUrls[pool.chainId];
        if (!apiUrl) return;

        // Get contract creator (deployer)
        const creatorResponse = await fetch(
          `${apiUrl}?module=contract&action=getcontractcreation&contractaddresses=${pool.baseToken.address}`
        );
        const creatorData = await creatorResponse.json();
        if (creatorData.status === '1' && creatorData.result?.[0]?.contractCreator) {
          setDeployerAddress(creatorData.result[0].contractCreator);
        }

        // Get token holders count (ERC20)
        // Note: This requires a paid API key for most explorers, so we'll use a fallback
        const holdersResponse = await fetch(
          `${apiUrl}?module=token&action=tokeninfo&contractaddress=${pool.baseToken.address}`
        );
        const holdersData = await holdersResponse.json();
        if (holdersData.status === '1' && holdersData.result?.[0]?.holdersCount) {
          setHoldersCount(parseInt(holdersData.result[0].holdersCount));
        }
      } catch (error) {
        console.error('Failed to fetch token info:', error);
      }
    };

    fetchTokenInfo();
  }, [pool.chainId, pool.baseToken.address]);

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
    <div className="h-screen flex flex-col bg-[#0d1117]">
      {/* Header with Token Info */}
      <header className="border-b border-[#30363d] bg-[#161b22] px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Back + Token pair + Price */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 hover:bg-[#30363d] rounded transition-colors flex-shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <TokenLogo
                symbol={pool.baseToken.symbol}
                imageUrl={pool.baseToken.imageUrl}
                chainId={pool.chainId}
                size={36}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1 sm:gap-2">
                  <h1 className="text-base sm:text-lg font-bold truncate">
                    {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                  </h1>
                  <span className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[#21262d] rounded text-gray-400">
                    {pool.chainId.toUpperCase()}
                  </span>
                  <span className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[#21262d] rounded text-gray-400">
                    {pool.dex}
                  </span>
                </div>
                {/* Real-time Price */}
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl font-bold text-white">
                    ${formatPrice(livePrice)}
                  </span>
                  <span className={`text-xs sm:text-sm font-medium ${priceChangeColor}`}>
                    {formatPercentage(pool.priceChange24h)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Wallet */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <WalletButton
              chainId={pool.chainId}
              baseTokenAddress={pool.baseToken.address}
              baseSymbol={pool.baseToken.symbol}
            />
          </div>
        </div>
      </header>

      {/* Token Info Card - Always visible */}
      <div className="border-b border-[#30363d] bg-[#161b22] px-2 sm:px-4 py-2">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
          {/* Stats */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Liq:</span>
            <span className="font-medium text-white">${formatNumber(pool.liquidity)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Vol:</span>
            <span className="font-medium text-white">${formatNumber(pool.volume24h)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Txns:</span>
            <span className="text-[#3fb950]">{pool.txns24h.buys}</span>
            <span className="text-gray-500">/</span>
            <span className="text-[#f85149]">{pool.txns24h.sells}</span>
          </div>
          {holdersCount !== null && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Holders:</span>
              <span className="font-medium text-white">{formatNumber(holdersCount)}</span>
            </div>
          )}
          {pool.createdAt && (
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-gray-500">Created:</span>
              <span className="font-medium text-white">
                {new Date(pool.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Addresses */}
          <div className="flex flex-wrap items-center gap-2 text-xs ml-auto">
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
            {deployerAddress && (
              <AddressChip
                label="Deployer"
                address={deployerAddress}
                explorerUrl={explorerUrl}
                copied={copied}
                onCopy={copyAddress}
              />
            )}
            <a
              href={`${explorerUrl}/token/${pool.baseToken.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-[#21262d] hover:bg-[#30363d] rounded transition-colors"
              title="View on Explorer"
            >
              <ExternalLink size={12} className="text-gray-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden border-b border-[#30363d] bg-[#161b22]">
        <div className="flex">
          <button
            onClick={() => setMobileTab('chart')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === 'chart'
                ? 'text-white border-b-2 border-[#58a6ff]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setMobileTab('orderbook')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === 'orderbook'
                ? 'text-white border-b-2 border-[#58a6ff]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Order Book
          </button>
          <button
            onClick={() => setMobileTab('trade')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mobileTab === 'trade'
                ? 'text-white border-b-2 border-[#58a6ff]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trade
          </button>
        </div>
      </div>

      {/* Main content - Desktop: horizontal layout, Mobile: tab-based */}
      <main className="flex-1 p-2 flex flex-col lg:flex-row gap-2 overflow-auto">
        {/* Desktop Layout: Order Book | Chart | Swap + Transactions */}

        {/* Left: Order Book - Hidden on mobile when not active */}
        <div className={`flex-shrink-0 w-full lg:w-64 xl:w-72 h-[calc(100vh-280px)] lg:h-auto lg:self-stretch ${
          mobileTab !== 'orderbook' ? 'hidden lg:block' : ''
        }`}>
          <LiquidityDepth
            chainId={pool.chainId}
            poolAddress={pool.poolAddress}
            priceUsd={livePrice}
            baseSymbol={pool.baseToken.symbol}
            quoteSymbol={pool.quoteToken.symbol}
            liquidityUsd={pool.liquidity}
            liquidityBase={pool.liquidityBase}
            liquidityQuote={pool.liquidityQuote}
            baseTokenAddress={pool.baseToken.address}
            quoteTokenAddress={pool.quoteToken.address}
          />
        </div>

        {/* Middle: Chart - Hidden on mobile when not active */}
        <div
          className={`flex-1 flex flex-col min-w-0 min-h-[400px] lg:min-h-0 ${
            mobileTab !== 'chart' ? 'hidden lg:flex' : ''
          }`}
        >
          {/* Chart - full height */}
          <div className="flex-1 bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
            <Chart
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              symbol={`${pool.baseToken.symbol}/${pool.quoteToken.symbol}`}
              baseTokenAddress={pool.baseToken.address}
              tradeEffect={tradeEffect}
              onTradeEffectComplete={handleTradeEffectComplete}
              onPriceUpdate={handlePriceUpdate}
            />
          </div>
        </div>

        {/* Right: Swap + Transactions stacked - Hidden on mobile when not active */}
        <div className={`flex-shrink-0 w-full lg:w-72 xl:w-80 flex flex-col gap-2 ${
          mobileTab !== 'trade' ? 'hidden lg:flex' : ''
        }`}>
          {/* Swap Panel */}
          <div className="flex-shrink-0">
            <TradePanel
              chainId={pool.chainId}
              baseTokenAddress={pool.baseToken.address}
              quoteTokenAddress={pool.quoteToken.address}
              baseSymbol={pool.baseToken.symbol}
              quoteSymbol={pool.quoteToken.symbol}
              onTradeSuccess={handleTradeSuccess}
            />
          </div>

          {/* Transactions - takes remaining space */}
          <div className="flex-1 min-h-[200px] overflow-hidden">
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
