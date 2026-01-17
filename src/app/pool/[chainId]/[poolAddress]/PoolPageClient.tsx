'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { PoolInfo, SearchResult, SUPPORTED_CHAINS } from '@/types';
import { formatNumber, formatPercentage, searchPools, formatPrice } from '@/lib/api';
import { ArrowLeft, ExternalLink, Copy, Check, Globe, Twitter, MessageCircle, Search, X, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import TokenLogo, { TokenPairLogos } from '@/components/TokenLogo';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const [tradeEffect, setTradeEffect] = useState<'buy' | 'sell' | null>(null);
  const [mobileTab, setMobileTab] = useState<'chart' | 'orderbook' | 'trade'>('chart');
  const [deployerAddress, setDeployerAddress] = useState<string | null>(null);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [livePrice, setLivePrice] = useState<number>(pool.priceUsd);
  const [orderBookPrecision, setOrderBookPrecision] = useState<number>(0); // Shared precision from Order Book
  // Aggregated order data from Order Book for Chart liquidity lines
  const [orderBookData, setOrderBookData] = useState<{ bids: Array<{ price: number; liquidityUSD: number }>; asks: Array<{ price: number; liquidityUSD: number }> } | null>(null);
  const priceChangeColor = pool.priceChange24h >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Handle precision change from Order Book for Chart sync
  const handlePrecisionChange = useCallback((precision: number) => {
    setOrderBookPrecision(precision);
  }, []);

  // Handle aggregated order data from Order Book for Chart liquidity lines
  const handleOrderDataChange = useCallback((data: { bids: Array<{ price: number; liquidityUSD: number }>; asks: Array<{ price: number; liquidityUSD: number }> }) => {
    setOrderBookData(data);
  }, []);


  // Search functionality
  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const results = await searchPools(trimmedQuery);
      setSearchResults(results.slice(0, 8)); // Limit to 8 results for compact view
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSelect = (result: SearchResult) => {
    router.push(`/pool/${result.chainId}/${result.poolAddress}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const getChainIcon = (chainId: string) => {
    return SUPPORTED_CHAINS.find((c) => c.id === chainId)?.icon || '🔗';
  };

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

    fetchTokenInfo().catch((err) => {
      console.error('Unhandled error in fetchTokenInfo:', err);
    });
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

          {/* Center: Search Bar */}
          <div ref={searchContainerRef} className="hidden sm:block flex-1 max-w-md mx-4 relative">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                size={16}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search token or pool..."
                className="w-full pl-9 pr-8 py-1.5 bg-[#0d1117] border border-[#30363d] rounded-lg text-sm text-[#c9d1d9] placeholder-gray-500 focus:outline-none focus:border-[#58a6ff] transition-colors"
              />
              {searchLoading && (
                <Loader2
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"
                  size={14}
                />
              )}
              {!searchLoading && searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={`${result.chainId}-${result.poolAddress}-${index}`}
                    onClick={() => handleSearchSelect(result)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[#21262d] transition-colors text-left"
                  >
                    <TokenPairLogos
                      baseSymbol={result.baseToken.symbol}
                      quoteSymbol={result.quoteToken.symbol}
                      baseImageUrl={result.baseToken.imageUrl}
                      chainId={result.chainId}
                      size={24}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">
                          {result.baseToken.symbol}/{result.quoteToken.symbol}
                        </span>
                        <span className="text-xs" title={result.chainId}>{getChainIcon(result.chainId)}</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {result.baseToken.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${formatPrice(result.priceUsd)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {showSearchResults && searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-center text-sm text-gray-400">
                No results for &quot;{searchQuery}&quot;
              </div>
            )}
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
            token0Decimals={pool.baseToken.decimals}
            token1Decimals={pool.quoteToken.decimals}
            dexId={pool.dex}
            onPrecisionChange={handlePrecisionChange}
            onOrderDataChange={handleOrderDataChange}
          />
        </div>

        {/* Middle: Chart + Liquidity Density - Hidden on mobile when not active */}
        <div
          className={`flex-1 flex flex-col min-w-0 min-h-[400px] lg:min-h-0 gap-2 ${
            mobileTab !== 'chart' ? 'hidden lg:flex' : ''
          }`}
        >
          {/* Chart - takes most space */}
          <div className="flex-1 bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden">
            <Chart
              chainId={pool.chainId}
              poolAddress={pool.poolAddress}
              symbol={`${pool.baseToken.symbol}/${pool.quoteToken.symbol}`}
              priceUsd={livePrice || pool.priceUsd}
              baseTokenAddress={pool.baseToken.address}
              quoteTokenAddress={pool.quoteToken.address}
              tradeEffect={tradeEffect}
              onTradeEffectComplete={handleTradeEffectComplete}
              onPriceUpdate={handlePriceUpdate}
              token0Decimals={pool.baseToken.decimals}
              token1Decimals={pool.quoteToken.decimals}
              token0Symbol={pool.baseToken.symbol}
              token1Symbol={pool.quoteToken.symbol}
              orderBookData={orderBookData}
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
