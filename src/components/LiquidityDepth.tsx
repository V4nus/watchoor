'use client';

import { useEffect, useState, useRef } from 'react';
import { DepthData } from '@/lib/liquidity';
import { formatNumber } from '@/lib/api';
import { isStablecoin } from '@/lib/quote-prices';
import { getRealtimeService, TradeEvent } from '@/lib/realtime';
import { useTranslations } from '@/lib/i18n/context';

// Aggregated order data for Chart sync
export interface AggregatedOrderData {
  bids: Array<{ price: number; liquidityUSD: number }>;
  asks: Array<{ price: number; liquidityUSD: number }>;
}

interface LiquidityDepthProps {
  chainId: string;
  poolAddress: string;
  priceUsd: number;
  baseSymbol: string;
  quoteSymbol: string;
  liquidityUsd?: number; // Fallback from DexScreener
  liquidityBase?: number; // Base token amount from DexScreener (e.g., PING)
  liquidityQuote?: number; // Quote token amount from DexScreener (e.g., USDC)
  baseTokenAddress?: string; // For V4 pools
  quoteTokenAddress?: string; // For V4 pools
  token0Decimals?: number;
  token1Decimals?: number;
  dexId?: string; // DEX identifier (e.g., "pumpswap", "raydium_clmm", "orca")
  onPrecisionChange?: (precision: number) => void; // Callback when precision changes
  onOrderDataChange?: (data: AggregatedOrderData) => void; // Callback when aggregated data changes
}

// Dynamic precision based on current price
type ViewMode = 'individual' | 'cumulative';

// Track changed values for highlighting
interface ChangedValue {
  price: number;
  field: 'base' | 'quote';
  direction: 'up' | 'down';
  timestamp: number;
}

export default function LiquidityDepth({
  chainId,
  poolAddress,
  priceUsd,
  baseSymbol,
  quoteSymbol,
  liquidityUsd,
  liquidityBase,
  liquidityQuote,
  baseTokenAddress,
  quoteTokenAddress,
  token0Decimals,
  token1Decimals,
  dexId,
  onPrecisionChange,
  onOrderDataChange,
}: LiquidityDepthProps) {
  const t = useTranslations();
  const [depthData, setDepthData] = useState<DepthData | null>(null);
  const [simpleData, setSimpleData] = useState<{
    token0: number;
    token1: number;
    token0Symbol: string;
    token1Symbol: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poolVersion, setPoolVersion] = useState<string | null>(null); // V2, V3, V4
  const [precisionIndex, setPrecisionIndex] = useState<number>(1); // 0=very fine, 1=fine, 2=medium, 3=coarse
  const [viewMode, setViewMode] = useState<ViewMode>('individual');
  const [changedValues, setChangedValues] = useState<Map<string, ChangedValue>>(new Map());
  const [quoteTokenUsdPrice, setQuoteTokenUsdPrice] = useState<number>(1);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tradeAdjustments, setTradeAdjustments] = useState<{ askConsumed: number; bidConsumed: number }>({ askConsumed: 0, bidConsumed: 0 });
  const isInitialLoad = useRef(true);
  const isFetchingRef = useRef(false); // Prevent request stacking
  const abortControllerRef = useRef<AbortController | null>(null); // Cancel stale requests
  const requestIdRef = useRef(0); // Track request sequence to discard stale responses
  const prevDataRef = useRef<Map<number, { base: number; quote: number }>>(new Map());
  const lastApiUpdateRef = useRef<number>(Date.now()); // Track when API data was refreshed

  // Fetch quote token USD price
  useEffect(() => {
    const fetchQuotePrice = async () => {
      // If quote token is a stablecoin, price is $1
      if (isStablecoin(quoteSymbol)) {
        setQuoteTokenUsdPrice(1);
        return;
      }

      try {
        const response = await fetch(`/api/quote-price?symbol=${encodeURIComponent(quoteSymbol)}`);
        const result = await response.json();
        if (result.success && result.price) {
          setQuoteTokenUsdPrice(result.price);
        }
      } catch (error) {
        console.error('Failed to fetch quote token price:', error);
        // Use fallback prices for common tokens
        const fallbacks: Record<string, number> = {
          'WETH': 3500, 'ETH': 3500,
          'WBNB': 600, 'BNB': 600,
          'WMATIC': 0.8, 'MATIC': 0.8,
          'SOL': 200, 'WSOL': 200,
        };
        setQuoteTokenUsdPrice(fallbacks[quoteSymbol.toUpperCase()] || 1);
      }
    };

    fetchQuotePrice();
    // Refresh every 5 minutes
    const interval = setInterval(fetchQuotePrice, 300000);
    return () => clearInterval(interval);
  }, [quoteSymbol]);

  // Subscribe to real-time trade events for liquidity adjustment
  useEffect(() => {
    if (!baseTokenAddress) return;

    const service = getRealtimeService();

    const handleTrade = (trade: TradeEvent) => {
      // Update trade adjustments (simulates liquidity consumption between API refreshes)
      setTradeAdjustments(prev => {
        if (trade.type === 'buy') {
          // Buy = ask liquidity consumed
          return { ...prev, askConsumed: prev.askConsumed + trade.estimatedVolumeUsd };
        } else {
          // Sell = bid liquidity consumed
          return { ...prev, bidConsumed: prev.bidConsumed + trade.estimatedVolumeUsd };
        }
      });
    };

    const unsubscribe = service.subscribeTrades(
      chainId,
      baseTokenAddress,
      liquidityUsd || 100000, // Use pool liquidity for volume estimation
      handleTrade
    );

    return () => unsubscribe();
  }, [chainId, baseTokenAddress, liquidityUsd]);

  useEffect(() => {
    const fetchData = async () => {
      // Skip if already fetching (prevent request stacking at 1s interval)
      if (isFetchingRef.current && !isInitialLoad.current) {
        return;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller and increment request ID
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentRequestId = ++requestIdRef.current;

      isFetchingRef.current = true;

      // Only show loading on initial load, not on refreshes
      if (isInitialLoad.current) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        // Build unified API params
        const isV4Pool = poolAddress.length === 66;

        // Calculate precision for V4 pools
        const priceMagnitude = Math.floor(Math.log10(priceUsd));
        const apiPrecision = isV4Pool ? Math.pow(10, priceMagnitude - 2) : 0;

        const params = new URLSearchParams({
          chainId,
          poolAddress,
          priceUsd: priceUsd.toString(),
          maxLevels: '0', // 0 = no limit, return all liquidity levels
          precision: apiPrecision.toString(),
        });

        // Add token addresses for V4 pools
        if (baseTokenAddress) {
          params.set('token0Address', baseTokenAddress);
        }
        if (quoteTokenAddress) {
          params.set('token1Address', quoteTokenAddress);
        }

        // Add Solana-specific params
        if (chainId === 'solana') {
          params.set('baseSymbol', baseSymbol);
          params.set('quoteSymbol', quoteSymbol);
          params.set('baseDecimals', (token0Decimals || 9).toString());
          params.set('quoteDecimals', (token1Decimals || 9).toString());
          if (dexId) params.set('dexId', dexId);
          if (liquidityUsd) params.set('liquidityUsd', liquidityUsd.toString());
        }

        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        // Use unified liquidity-depth API for all pool types
        const response = await fetch(`/api/liquidity-depth?${params}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const apiResult = await response.json();

        let result;
        if (response.ok && apiResult.success && apiResult.data) {
          const { bids, asks, currentPrice, token0Symbol, token1Symbol, token0Decimals, token1Decimals, poolType } = apiResult.data;

          console.log(`[LiquidityDepth] ${poolType.toUpperCase()} pool: ${bids?.length || 0} bids, ${asks?.length || 0} asks`);

          // Filter out invalid price levels
          const minValidPrice = priceUsd * 0.001;
          const maxValidPrice = priceUsd * 1000;
          const isValidPrice = (price: number) => price > 0 && price >= minValidPrice && price <= maxValidPrice && isFinite(price);
          const maxReasonableAmount = 1e15;
          const isValidAmount = (amount: number) => !amount || (amount > 0 && amount < maxReasonableAmount && isFinite(amount));

          result = {
            type: 'depth',
            version: poolType, // v2, v3, v4
            data: {
              bids: (bids || []).filter((b: { price: number; liquidityUSD: number; token0Amount: number }) =>
                isValidPrice(b.price) && isValidAmount(b.token0Amount)),
              asks: (asks || []).filter((a: { price: number; liquidityUSD: number; token0Amount: number }) =>
                isValidPrice(a.price) && isValidAmount(a.token0Amount)),
              currentPrice: currentPrice || priceUsd,
              token0Symbol: token0Symbol || baseSymbol,
              token1Symbol: token1Symbol || quoteSymbol,
              token0Decimals: token0Decimals || 18,
              token1Decimals: token1Decimals || 6,
            },
          };
        } else {
          result = { error: apiResult.error || 'Failed to fetch liquidity data' };
        }

        // Discard stale response if a newer request was made
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          setError(result.error || 'Failed to fetch liquidity data');
          setDepthData(null);
          setSimpleData(null);
        } else if (result.type === 'depth') {
          // Extract pool version from API response
          if (result.version) {
            setPoolVersion(result.version.toUpperCase()); // v2 -> V2, v3 -> V3, v4 -> V4
          }
          const newData = result.data as DepthData;

          // Detect changes for highlighting (Binance-style)
          if (!isInitialLoad.current) {
            const newChanges = new Map<string, ChangedValue>();
            const now = Date.now();

            // Helper: check if value changed significantly (>0.1% or any change for small values)
            const hasChanged = (newVal: number, oldVal: number): boolean => {
              if (oldVal === 0) return newVal > 0;
              const percentChange = Math.abs((newVal - oldVal) / oldVal);
              return percentChange > 0.001; // 0.1% threshold
            };

            // Check bids
            newData.bids.forEach((bid) => {
              const key = `bid-${bid.price.toFixed(8)}`;
              const prev = prevDataRef.current.get(bid.price);
              const newBase = bid.token1Amount > 0 && bid.price > 0 ? bid.token1Amount / bid.price : 0;
              const newQuote = bid.token1Amount;

              if (prev) {
                if (hasChanged(newBase, prev.base)) {
                  newChanges.set(`${key}-base`, {
                    price: bid.price,
                    field: 'base',
                    direction: newBase > prev.base ? 'up' : 'down',
                    timestamp: now,
                  });
                }
                if (hasChanged(newQuote, prev.quote)) {
                  newChanges.set(`${key}-quote`, {
                    price: bid.price,
                    field: 'quote',
                    direction: newQuote > prev.quote ? 'up' : 'down',
                    timestamp: now,
                  });
                }
              }
              prevDataRef.current.set(bid.price, { base: newBase, quote: newQuote });
            });

            // Check asks
            newData.asks.forEach((ask) => {
              const key = `ask-${ask.price.toFixed(8)}`;
              const prev = prevDataRef.current.get(ask.price);
              const newBase = ask.token0Amount;
              const newQuote = ask.token0Amount * ask.price;

              if (prev) {
                if (hasChanged(newBase, prev.base)) {
                  newChanges.set(`${key}-base`, {
                    price: ask.price,
                    field: 'base',
                    direction: newBase > prev.base ? 'up' : 'down',
                    timestamp: now,
                  });
                }
                if (hasChanged(newQuote, prev.quote)) {
                  newChanges.set(`${key}-quote`, {
                    price: ask.price,
                    field: 'quote',
                    direction: newQuote > prev.quote ? 'up' : 'down',
                    timestamp: now,
                  });
                }
              }
              prevDataRef.current.set(ask.price, { base: newBase, quote: newQuote });
            });

            if (newChanges.size > 0) {
              setChangedValues(newChanges);
              // Clear highlights after 800ms (match animation duration)
              setTimeout(() => setChangedValues(new Map()), 800);
            }
          } else {
            // Initialize prevDataRef on first load
            newData.bids.forEach((bid) => {
              const base = bid.token1Amount > 0 && bid.price > 0 ? bid.token1Amount / bid.price : 0;
              prevDataRef.current.set(bid.price, { base, quote: bid.token1Amount });
            });
            newData.asks.forEach((ask) => {
              prevDataRef.current.set(ask.price, { base: ask.token0Amount, quote: ask.token0Amount * ask.price });
            });
          }

          setDepthData(newData);
          setSimpleData(null);
          setLastUpdated(new Date());
          // Reset trade adjustments when fresh API data arrives
          setTradeAdjustments({ askConsumed: 0, bidConsumed: 0 });
          lastApiUpdateRef.current = Date.now();
        } else {
          setError(result.error || 'Unknown response type');
          setDepthData(null);
          setSimpleData(null);
        }
      } catch (err) {
        // Ignore abort errors from cancelled requests
        if (err instanceof Error && err.name === 'AbortError') {
          // Only show timeout error if this was still the active request
          if (currentRequestId === requestIdRef.current && isInitialLoad.current) {
            setError(t.liquidityDepth.requestTimeout);
          }
          return;
        }

        console.error('Liquidity fetch error:', err);
        // Don't set error on refresh failures, keep showing old data
        if (isInitialLoad.current && currentRequestId === requestIdRef.current) {
          setError(t.liquidityDepth.fetchFailed);
        }
      } finally {
        // Only update state if this is still the active request
        if (currentRequestId === requestIdRef.current) {
          setIsRefreshing(false);
          isFetchingRef.current = false;

          if (isInitialLoad.current) {
            setLoading(false);
            isInitialLoad.current = false;
          }
        }
      }
    };

    fetchData();
    // Update every 6 seconds (API has 5-second cache, so we poll slightly after cache expires for fresh data)
    const interval = setInterval(fetchData, 6000);
    return () => {
      clearInterval(interval);
      // Cancel any pending request on cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [chainId, poolAddress, priceUsd, baseTokenAddress, quoteTokenAddress, baseSymbol, quoteSymbol]);

  // Calculate dynamic precision options based on current price
  const getPrecisionOptions = (price: number): number[] => {
    if (!price || price <= 0) return [0.0001, 0.001, 0.01];

    // Find the order of magnitude of the price
    const magnitude = Math.floor(Math.log10(price));

    // Generate 4 precision levels for finer control
    // Very Fine (1/1000), Fine (1/100), Medium (1/10), Coarse (same magnitude)
    const base = Math.pow(10, magnitude - 3);
    return [
      Number(base.toPrecision(1)),           // Very fine (e.g., 0.001 for $5)
      Number((base * 10).toPrecision(1)),    // Fine (e.g., 0.01 for $5)
      Number((base * 100).toPrecision(1)),   // Medium (e.g., 0.1 for $5)
      Number((base * 1000).toPrecision(1))   // Coarse (e.g., 1.0 for $5)
    ];
  };

  const precisionOptions = depthData?.currentPrice ? getPrecisionOptions(depthData.currentPrice) : [0.0001, 0.001, 0.01];
  const safeIndex = Math.min(precisionIndex, precisionOptions.length - 1);
  const currentPrecision = precisionOptions[safeIndex] || 0.001;

  // Notify parent when precision changes (for Chart sync)
  useEffect(() => {
    if (currentPrecision > 0 && onPrecisionChange) {
      onPrecisionChange(currentPrecision);
    }
  }, [currentPrecision, onPrecisionChange]);

  // Notify parent when aggregated order data changes (for Chart liquidity lines)
  useEffect(() => {
    if (!onOrderDataChange) return;
    if (!depthData || !depthData.bids.length || !depthData.asks.length) return;

    const filteredData = getFilteredData();
    if (!filteredData) return;

    // Send aggregated bids and asks to Chart
    const orderData: AggregatedOrderData = {
      bids: filteredData.bids.map(b => ({ price: b.price, liquidityUSD: b.liquidityUSD })),
      asks: filteredData.asks.map(a => ({ price: a.price, liquidityUSD: a.liquidityUSD })),
    };

    onOrderDataChange(orderData);
  }, [depthData, currentPrecision, onOrderDataChange]);

  // Aggregate depth data by price precision (like Binance/Gate)
  const getFilteredData = () => {
    if (!depthData) return null;

    const precision = currentPrecision || 0.001;
    if (precision <= 0 || !isFinite(precision)) return depthData; // Safety fallback

    // Round price to precision level
    // Bids: floor (aggregate at lower price) - like Binance
    // Asks: ceil (aggregate at higher price) - like Binance
    // This ensures bids[0].price < asks[0].price (spread exists)
    const floorToLevel = (price: number) => {
      if (!price || !isFinite(price)) return 0;
      const floored = Math.floor(price / precision) * precision;
      // CRITICAL FIX: Prevent zero price aggregation - use minimum of precision/10 as floor
      return floored > 0 ? floored : Math.min(price, precision / 10);
    };
    const ceilToLevel = (price: number) => {
      if (!price || !isFinite(price)) return 0;
      const ceiled = Math.ceil(price / precision) * precision;
      // CRITICAL FIX: Prevent zero price aggregation - use minimum of precision/10 as floor
      return ceiled > 0 ? ceiled : Math.min(price, precision / 10);
    };

    // Aggregate bids by price level (floor - lower price)
    const bidMap = new Map<number, { token0Amount: number; token1Amount: number; liquidityUSD: number }>();
    for (const bid of depthData.bids) {
      const level = floorToLevel(bid.price);
      // Skip zero-price levels (invalid data)
      if (level <= 0) continue;
      const existing = bidMap.get(level) || { token0Amount: 0, token1Amount: 0, liquidityUSD: 0 };
      existing.token0Amount += bid.token0Amount;
      existing.token1Amount += bid.token1Amount;
      existing.liquidityUSD += bid.liquidityUSD;
      bidMap.set(level, existing);
    }

    // Aggregate asks by price level (ceil - higher price)
    const askMap = new Map<number, { token0Amount: number; token1Amount: number; liquidityUSD: number }>();
    for (const ask of depthData.asks) {
      const level = ceilToLevel(ask.price);
      // Skip zero-price levels (invalid data)
      if (level <= 0) continue;
      const existing = askMap.get(level) || { token0Amount: 0, token1Amount: 0, liquidityUSD: 0 };
      existing.token0Amount += ask.token0Amount;
      existing.token1Amount += ask.token1Amount;
      existing.liquidityUSD += ask.liquidityUSD;
      askMap.set(level, existing);
    }

    // Convert back to array format
    // For bids: liquidityUSD = token1Amount (USDC is already USD)
    // For asks: recalculate liquidityUSD based on aggregated price level
    const aggregatedBids = Array.from(bidMap.entries())
      .map(([price, data]) => ({ price, ...data }))
      .sort((a, b) => b.price - a.price); // Descending

    const aggregatedAsks = Array.from(askMap.entries())
      .map(([price, data]) => ({
        price,
        token0Amount: data.token0Amount,
        token1Amount: data.token0Amount * price, // Recalculate based on aggregated price
        liquidityUSD: data.token0Amount * price, // Recalculate based on aggregated price
      }))
      .sort((a, b) => a.price - b.price); // Ascending

    return { ...depthData, bids: aggregatedBids, asks: aggregatedAsks };
  };

  // Get highlight class for changed values
  const getHighlightClass = (type: 'bid' | 'ask', price: number, field: 'base' | 'quote'): string => {
    const key = `${type}-${price.toFixed(8)}-${field}`;
    const change = changedValues.get(key);
    if (!change) return '';
    return change.direction === 'up'
      ? 'animate-flash-green'
      : 'animate-flash-red';
  };

  if (loading) {
    return (
      <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
        <div className="text-center text-gray-400 animate-pulse">Loading liquidity data...</div>
      </div>
    );
  }

  if (error) {
    // Show DexScreener liquidity as fallback
    if (liquidityUsd && liquidityUsd > 0) {
      return (
        <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
          <div className="text-sm font-medium mb-3">Pool Liquidity</div>
          <div className="text-center py-4">
            <div className="text-2xl font-bold text-white">${formatNumber(liquidityUsd)}</div>
            <div className="text-xs text-gray-400 mt-1">Total Liquidity (USD)</div>
          </div>
          <div className="text-xs text-gray-500 text-center mt-2 border-t border-[#30363d] pt-2">
            {baseSymbol}/{quoteSymbol}
          </div>
          <div className="text-xs text-gray-600 text-center mt-1">
            On-chain depth data unavailable
          </div>
        </div>
      );
    }
    return (
      <div className="p-4 bg-[#161b22] rounded-lg border border-[#30363d]">
        <div className="text-center text-gray-500 text-sm">{error}</div>
      </div>
    );
  }

  // V3/V4 Depth Chart
  const filteredData = getFilteredData();
  if (filteredData) {
    const maxBidLiquidity = Math.max(...filteredData.bids.map(b => b.liquidityUSD), 1);
    const maxAskLiquidity = Math.max(...filteredData.asks.map(a => a.liquidityUSD), 1);
    const maxLiquidity = Math.max(maxBidLiquidity, maxAskLiquidity);

    return (
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden h-full flex flex-col">
        {/* Header Row 1: Title */}
        <div className="px-2 sm:px-3 py-2 border-b border-[#30363d] flex-shrink-0">
          <div className="flex items-center justify-between mb-2 gap-1">
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm font-medium">Order Book</span>
              {poolVersion && (
                <span className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-[#21262d] text-[#58a6ff] rounded">
                  {poolVersion}
                </span>
              )}
            </div>
            {/* Precision Selector - dynamic based on price */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#21262d] rounded p-0.5">
              {precisionOptions.map((precision, idx) => (
                <button
                  key={precision}
                  onClick={() => setPrecisionIndex(idx)}
                  className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded transition-colors ${
                    precisionIndex === idx
                      ? 'bg-[#30363d] text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {formatPrecision(precision)}
                </button>
              ))}
            </div>
          </div>
          {/* Row 2: View Mode Toggle + Large Orders Toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#21262d] rounded p-0.5 w-fit">
              <button
                onClick={() => setViewMode('individual')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  viewMode === 'individual'
                    ? 'bg-[#30363d] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setViewMode('cumulative')}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                  viewMode === 'cumulative'
                    ? 'bg-[#30363d] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Total
              </button>
            </div>
          </div>
        </div>

        <div className="p-1 sm:p-2 flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="grid grid-cols-3 text-[10px] sm:text-xs text-gray-400 px-1 sm:px-2 mb-1 flex-shrink-0">
            <span>Price</span>
            <span className="text-center truncate">{filteredData.token0Symbol}</span>
            <span className="text-right">USD</span>
          </div>

          {/* Asks (sell side) - above current price - scrollable, bottom-aligned */}
          <div
            className="flex-1 mb-2 min-h-0"
            style={{ overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: '#484f58 #161b22', display: 'flex', flexDirection: 'column-reverse' }}
          >
              {filteredData.asks.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-2">No asks in range</div>
              ) : (
                (() => {
                  const asksToShow = filteredData.asks;
                  // Apply trade consumption - reduce from levels closest to current price
                  let remainingConsumed = tradeAdjustments.askConsumed;
                  const adjustedAsks = asksToShow.map((level) => {
                    if (remainingConsumed > 0) {
                      const consumed = Math.min(remainingConsumed, level.liquidityUSD);
                      remainingConsumed -= consumed;
                      const consumptionRatio = (level.liquidityUSD - consumed) / Math.max(level.liquidityUSD, 0.001);
                      return {
                        ...level,
                        token0Amount: level.token0Amount * consumptionRatio,
                        liquidityUSD: Math.max(0, level.liquidityUSD - consumed),
                      };
                    }
                    return level;
                  });

                  // Calculate cumulative values (from lowest price upward)
                  // token0Amount = base token (what's for sale)
                  // token1Amount = quote token equivalent
                  let cumBaseAmount = 0;
                  let cumQuoteAmount = 0;
                  let cumLiquidityUSD = 0;
                  const asksWithCumulative = adjustedAsks.map((level) => {
                    // Use pre-calculated amounts from backend
                    const baseAmount = level.token0Amount;  // Base token for sale
                    const quoteAmount = level.token1Amount; // Quote token equivalent
                    cumBaseAmount += baseAmount;
                    cumQuoteAmount += quoteAmount;
                    cumLiquidityUSD += level.liquidityUSD;
                    return {
                      ...level,
                      baseAmount,
                      quoteAmount,
                      cumBaseAmount,
                      cumQuoteAmount,
                      cumLiquidityUSD,
                    };
                  });
                  const maxCumLiquidity = viewMode === 'cumulative' ? asksWithCumulative[asksWithCumulative.length - 1]?.cumLiquidityUSD || 1 : maxLiquidity;

                  return (
                    <div className="space-y-0.5">
                      {asksWithCumulative.reverse().map((level, i) => {
                        const displayBase = viewMode === 'cumulative' ? level.cumBaseAmount : level.baseAmount;
                        const displayUsd = viewMode === 'cumulative' ? level.cumLiquidityUSD : level.liquidityUSD;
                        const priceInUsd = level.price; // Already in USD from API (calculated using priceUsd param)
                        const displayLiquidity = viewMode === 'cumulative' ? level.cumLiquidityUSD : level.liquidityUSD;
                        const baseHighlight = getHighlightClass('ask', level.price, 'base');
                        const quoteHighlight = getHighlightClass('ask', level.price, 'quote');
                        return (
                          <div key={`ask-${i}`} className="relative">
                            <div
                              className="absolute right-0 top-0 bottom-0 bg-[#f85149]/20"
                              style={{ width: `${(displayLiquidity / maxCumLiquidity) * 100}%` }}
                            />
                            <div className="relative grid grid-cols-3 text-[10px] sm:text-xs px-1 sm:px-2 py-0.5">
                              <span className="text-[#f85149]">${formatPrice(priceInUsd)}</span>
                              <span className={`text-center ${baseHighlight}`}>{formatNumber(displayBase)}</span>
                              <span className={`text-right ${quoteHighlight}`}>${formatNumber(displayUsd)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
          </div>

          {/* Current Price */}
          <div className="bg-[#30363d] px-1 sm:px-2 py-1 my-1 flex-shrink-0">
            <div className="flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-medium">${formatNumber(priceUsd)}</span>
            </div>
          </div>

          {/* Bids (buy side) - below current price - scrollable */}
          <div
            className="flex-1 mt-2 min-h-0"
            style={{ overflowY: 'scroll', scrollbarWidth: 'thin', scrollbarColor: '#484f58 #161b22' }}
          >
            {/* Bids Header */}
            <div className="grid grid-cols-3 text-[10px] sm:text-xs text-gray-400 px-1 sm:px-2 mb-1 sticky top-0 bg-[#161b22]">
              <span>Price</span>
              <span className="text-center truncate">{filteredData.token0Symbol}</span>
              <span className="text-right">USD</span>
            </div>
            {filteredData.bids.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-2">No bids in range</div>
            ) : (
              (() => {
                const bidsToShow = filteredData.bids;
                // Apply trade consumption - reduce from levels closest to current price
                let remainingConsumed = tradeAdjustments.bidConsumed;
                const adjustedBids = bidsToShow.map((level) => {
                  if (remainingConsumed > 0) {
                    const consumed = Math.min(remainingConsumed, level.liquidityUSD);
                    remainingConsumed -= consumed;
                    const consumptionRatio = (level.liquidityUSD - consumed) / Math.max(level.liquidityUSD, 0.001);
                    return {
                      ...level,
                      token1Amount: level.token1Amount * consumptionRatio,
                      liquidityUSD: Math.max(0, level.liquidityUSD - consumed),
                    };
                  }
                  return level;
                });

                // Calculate cumulative values (from highest price downward)
                // token0Amount = base token (what you can buy)
                // token1Amount = quote token (what you pay with)
                let cumBaseAmount = 0;
                let cumQuoteAmount = 0;
                let cumLiquidityUSD = 0;
                const bidsWithCumulative = adjustedBids.map((level) => {
                  // Use pre-calculated amounts from backend
                  const baseAmount = level.token0Amount;  // Base token you can buy
                  const quoteAmount = level.token1Amount; // Quote token available
                  cumBaseAmount += baseAmount;
                  cumQuoteAmount += quoteAmount;
                  cumLiquidityUSD += level.liquidityUSD;
                  return {
                    ...level,
                    baseAmount,
                    quoteAmount,
                    cumBaseAmount,
                    cumQuoteAmount,
                    cumLiquidityUSD,
                  };
                });
                const maxCumLiquidity = viewMode === 'cumulative' ? bidsWithCumulative[bidsWithCumulative.length - 1]?.cumLiquidityUSD || 1 : maxLiquidity;

                return (
                  <div className="space-y-0.5">
                    {bidsWithCumulative.map((level, i) => {
                      const displayBase = viewMode === 'cumulative' ? level.cumBaseAmount : level.baseAmount;
                      const displayUsd = viewMode === 'cumulative' ? level.cumLiquidityUSD : level.liquidityUSD;
                      const priceInUsd = level.price; // Already in USD from API (calculated using priceUsd param)
                      const displayLiquidity = viewMode === 'cumulative' ? level.cumLiquidityUSD : level.liquidityUSD;
                      const baseHighlight = getHighlightClass('bid', level.price, 'base');
                      const quoteHighlight = getHighlightClass('bid', level.price, 'quote');
                      return (
                        <div key={`bid-${i}`} className="relative">
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[#3fb950]/20"
                            style={{ width: `${(displayLiquidity / maxCumLiquidity) * 100}%` }}
                          />
                          <div className="relative grid grid-cols-3 text-[10px] sm:text-xs px-1 sm:px-2 py-0.5">
                            <span className="text-[#3fb950]">${formatPrice(priceInUsd)}</span>
                            <span className={`text-center ${baseHighlight}`}>{formatNumber(displayBase)}</span>
                            <span className={`text-right ${quoteHighlight}`}>${formatNumber(displayUsd)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Summary - hidden on mobile to save space */}
          <div className="mt-2 pt-2 border-t border-[#30363d] text-[10px] sm:text-xs text-gray-400 px-1 sm:px-2 space-y-1 flex-shrink-0 hidden sm:block">
            <div className="flex justify-between">
              <span>{filteredData.token0Symbol}/{filteredData.token1Symbol}</span>
              <span>
                {filteredData.bids.length} bids / {filteredData.asks.length} asks
              </span>
            </div>
            {/* Pool Reserves - from DexScreener */}
            {(liquidityBase || liquidityQuote) && (
              <>
                <div className="flex justify-between border-t border-[#21262d] pt-1 mt-1">
                  <span className="text-gray-500">Pool Reserves</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#f85149]">{baseSymbol}</span>
                  <span className="text-[#f85149]">{formatNumber(liquidityBase || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#3fb950]">{quoteSymbol}</span>
                  <span className="text-[#3fb950]">{formatNumber(liquidityQuote || 0)}</span>
                </div>
              </>
            )}
            {!isStablecoin(quoteSymbol) && quoteTokenUsdPrice > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>1 {quoteSymbol} =</span>
                <span className="text-[#58a6ff]">${formatNumber(quoteTokenUsdPrice)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Simple Liquidity Display (V2 pools)
  if (simpleData) {
    const total = simpleData.token0 * priceUsd + simpleData.token1;
    const token0Pct = (simpleData.token0 * priceUsd / total) * 100 || 50;

    return (
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium">Pool Liquidity</span>
          {poolVersion && (
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-[#21262d] text-[#58a6ff] rounded">
              {poolVersion}
            </span>
          )}
        </div>

        {/* Liquidity Bar */}
        <div className="h-6 rounded-full overflow-hidden flex mb-3">
          <div
            className="bg-[#3fb950] flex items-center justify-center text-xs font-medium"
            style={{ width: `${token0Pct}%` }}
          >
            {token0Pct > 15 && `${token0Pct.toFixed(0)}%`}
          </div>
          <div
            className="bg-[#58a6ff] flex items-center justify-center text-xs font-medium"
            style={{ width: `${100 - token0Pct}%` }}
          >
            {(100 - token0Pct) > 15 && `${(100 - token0Pct).toFixed(0)}%`}
          </div>
        </div>

        {/* Token amounts */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#3fb950]" />
              <span>{simpleData.token0Symbol}</span>
            </div>
            <span className="font-mono">{formatNumber(simpleData.token0)}</span>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#58a6ff]" />
              <span>{simpleData.token1Symbol}</span>
            </div>
            <span className="font-mono">{formatNumber(simpleData.token1)}</span>
          </div>
          <div className="pt-2 border-t border-[#30363d] flex justify-between">
            <span className="text-gray-400">Total Value</span>
            <span className="font-medium">${formatNumber(total)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function formatPrice(price: number): string {
  // Handle invalid values
  if (!isFinite(price) || price <= 0) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);

  // For small prices, use significant digits to avoid trailing zeros
  // This gives us clean display like 0.001234 instead of 0.00123400
  if (price >= 0.0001) {
    // Show 4 significant digits after leading zeros
    const str = price.toFixed(8);
    // Remove trailing zeros after decimal point
    return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  if (price >= 0.00000001) {
    const str = price.toFixed(10);
    return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  // For extremely small prices, use exponential notation
  const exp = price.toExponential(4);
  return exp === '0.0000e+0' ? '0.00' : exp;
}

function formatPrecision(precision: number): string {
  if (precision >= 1) return precision.toFixed(0);
  // Count decimal places needed
  const str = precision.toString();
  if (str.includes('e')) {
    // Handle scientific notation like 1e-5
    const exp = parseInt(str.split('e')[1]);
    return precision.toFixed(Math.abs(exp));
  }
  const decimals = str.split('.')[1]?.length || 0;
  return precision.toFixed(decimals);
}
