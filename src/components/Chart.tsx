'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  ColorType,
  CrosshairMode,
  HistogramData,
  Time,
  PriceScaleMode,
} from 'lightweight-charts';
import { OHLCVData, TimeInterval, TIME_INTERVALS } from '@/types';
import { getOHLCVData } from '@/lib/api';
import { getRealtimeService, OHLCVUpdate, RealtimeBar } from '@/lib/realtime';
import { OrderBookBarsPrimitive } from '@/lib/chart-primitives';

export type TradeEffectType = 'buy' | 'sell' | null;

// Large order from order book data (AMM liquidity converted to limit orders)
interface LargeOrder {
  price: number;
  liquidityUSD: number;
  type: 'bid' | 'ask';  // bid = buy order, ask = sell order
  rank: number;  // 1-5, closer to current price = lower rank (more important)
}

// Raw order data from Order Book (Chart will aggregate using its own precision)
interface OrderBookData {
  bids: Array<{ price: number; liquidityUSD: number; token0Amount: number; token1Amount: number }>;
  asks: Array<{ price: number; liquidityUSD: number; token0Amount: number; token1Amount: number }>;
}

// Calculate dynamic precision options based on price
function getPrecisionOptions(price: number): number[] {
  if (!price || price <= 0) return [0.0001, 0.001, 0.01, 0.1];
  const magnitude = Math.floor(Math.log10(price));
  const base = Math.pow(10, magnitude - 3);
  return [
    Number(base.toPrecision(1)),           // Very fine
    Number((base * 10).toPrecision(1)),    // Fine
    Number((base * 100).toPrecision(1)),   // Medium
    Number((base * 1000).toPrecision(1))   // Coarse
  ];
}

// Aggregate order data by precision
function aggregateOrderData(
  data: OrderBookData,
  precision: number
): { bids: Array<{ price: number; liquidityUSD: number }>; asks: Array<{ price: number; liquidityUSD: number }> } {
  const floorToLevel = (price: number) => {
    const floored = Math.floor(price / precision) * precision;
    return floored > 0 ? floored : Math.min(price, precision / 10);
  };
  const ceilToLevel = (price: number) => {
    const ceiled = Math.ceil(price / precision) * precision;
    return ceiled > 0 ? ceiled : Math.min(price, precision / 10);
  };

  // Aggregate bids
  const bidMap = new Map<number, number>();
  for (const bid of data.bids) {
    const level = floorToLevel(bid.price);
    if (level <= 0) continue;
    bidMap.set(level, (bidMap.get(level) || 0) + bid.liquidityUSD);
  }

  // Aggregate asks
  const askMap = new Map<number, number>();
  for (const ask of data.asks) {
    const level = ceilToLevel(ask.price);
    if (level <= 0) continue;
    askMap.set(level, (askMap.get(level) || 0) + ask.liquidityUSD);
  }

  return {
    bids: Array.from(bidMap.entries())
      .map(([price, liquidityUSD]) => ({ price, liquidityUSD }))
      .sort((a, b) => b.price - a.price),
    asks: Array.from(askMap.entries())
      .map(([price, liquidityUSD]) => ({ price, liquidityUSD }))
      .sort((a, b) => a.price - b.price),
  };
}

// Format precision for display
function formatPrecision(precision: number): string {
  if (precision >= 1) return precision.toFixed(0);
  const str = precision.toString();
  if (str.includes('e')) {
    const exp = parseInt(str.split('e')[1]);
    return precision.toFixed(Math.abs(exp));
  }
  const decimals = str.split('.')[1]?.length || 0;
  return precision.toFixed(decimals);
}

interface ChartProps {
  chainId: string;
  poolAddress: string;
  symbol: string;
  priceUsd?: number;
  baseTokenAddress?: string;
  quoteTokenAddress?: string;
  tradeEffect?: TradeEffectType;
  onTradeEffectComplete?: () => void;
  onPriceUpdate?: (price: number) => void;
  onIntervalChange?: (interval: TimeInterval) => void; // Callback when timeframe changes
  token0Decimals?: number;
  token1Decimals?: number;
  token0Symbol?: string;
  token1Symbol?: string;
  orderBookData?: OrderBookData | null; // Pre-aggregated data from Order Book
}

type ScaleMode = 'regular' | 'indexed' | 'logarithmic';

const SCALE_MODES: { label: string; value: ScaleMode }[] = [
  { label: 'Regular', value: 'regular' },
  { label: 'Indexed to 100', value: 'indexed' },
  { label: 'Log', value: 'logarithmic' },
];

export default function Chart({
  chainId,
  poolAddress,
  symbol,
  priceUsd,
  baseTokenAddress,
  quoteTokenAddress,
  tradeEffect,
  onTradeEffectComplete,
  onPriceUpdate,
  onIntervalChange,
  token0Decimals = 18,
  token1Decimals = 18,
  token0Symbol = 'Token0',
  token1Symbol = 'Token1',
  orderBookData = null,
}: ChartProps) {
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastBarRef = useRef<RealtimeBar | null>(null);
  const orderBookPrimitiveRef = useRef<OrderBookBarsPrimitive | null>(null);

  const [interval, setInterval] = useState<TimeInterval>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('regular');
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [scaleMenuPosition, setScaleMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isLive, setIsLive] = useState(false);
  const scaleMenuRef = useRef<HTMLDivElement>(null);
  const [showTradeEffect, setShowTradeEffect] = useState<'buy' | 'sell' | null>(null);
  const [tradeEffectY, setTradeEffectY] = useState<number | null>(null);
  const [showLargeOrders, setShowLargeOrders] = useState(true);
  const [largeOrders, setLargeOrders] = useState<LargeOrder[]>([]);
  const [ordersPrecisionIndex, setOrdersPrecisionIndex] = useState<number>(3); // Default to "Coarse" precision (4th level)
  const maxLiquidityRef = useRef<number>(0); // Track max liquidity for bar width scaling
  const isInitialLoadRef = useRef<boolean>(true); // Track if this is the first data load

  // Notify parent when interval changes (for Order Book precision sync)
  useEffect(() => {
    if (onIntervalChange) {
      onIntervalChange(interval);
    }
  }, [interval, onIntervalChange]);

  // Handle trade effect trigger from parent
  useEffect(() => {
    if (tradeEffect) {
      // Get current price Y coordinate from chart
      const candleSeries = candleSeriesRef.current;
      const lastBar = lastBarRef.current;

      if (candleSeries && lastBar) {
        // Get Y coordinate for current price
        const yCoord = candleSeries.priceToCoordinate(lastBar.close);
        if (yCoord !== null) {
          setTradeEffectY(yCoord);
        }
      }

      setShowTradeEffect(tradeEffect);
      // Auto-clear effect after animation completes (4 seconds for slower animation)
      const timer = setTimeout(() => {
        setShowTradeEffect(null);
        setTradeEffectY(null);
        onTradeEffectComplete?.();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [tradeEffect, onTradeEffectComplete]);

  // Initialize main chart
  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    const chart = createChart(mainChartContainerRef.current, {
      width: mainChartContainerRef.current.clientWidth,
      height: mainChartContainerRef.current.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#0d1117' }, textColor: '#c9d1d9' },
      grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#58a6ff', width: 1, style: 2, labelBackgroundColor: '#58a6ff' },
        horzLine: { color: '#58a6ff', width: 1, style: 2, labelBackgroundColor: '#58a6ff' },
      },
      rightPriceScale: { borderColor: '#30363d', scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: '#30363d', timeVisible: true, secondsVisible: false },
      handleScale: { axisPressedMouseMove: true, pinch: true, mouseWheel: true },
      handleScroll: { vertTouchDrag: true, horzTouchDrag: true, mouseWheel: true, pressedMouseMove: true },
      watermark: {
        visible: true,
        text: 'Watchoor',
        fontSize: 100,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontStyle: 'bold',
        color: 'rgba(255, 255, 255, 0.06)',
        horzAlign: 'center',
        vertAlign: 'center',
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#02C076', downColor: '#F6465D',
      borderUpColor: '#02C076', borderDownColor: '#F6465D',
      wickUpColor: '#02C076', wickDownColor: '#F6465D',
      priceFormat: { type: 'price', precision: 8, minMove: 0.00000001 },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    mainChartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (mainChartContainerRef.current) {
        chart.applyOptions({
          width: mainChartContainerRef.current.clientWidth,
          height: mainChartContainerRef.current.clientHeight,
        });
      }
    };

    // Use ResizeObserver to detect container size changes (for resizable panels)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (mainChartContainerRef.current) {
      resizeObserver.observe(mainChartContainerRef.current);
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    // Right-click context menu for Y-axis (price scale)
    const handleContextMenu = (e: MouseEvent) => {
      const container = mainChartContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const containerWidth = rect.width;

      // Check if click is on the right side (Y-axis area, approximately last 60px)
      const yAxisWidth = 60;
      if (x > containerWidth - yAxisWidth) {
        e.preventDefault();
        setScaleMenuPosition({ x: e.clientX, y: e.clientY });
        setShowScaleMenu(true);
      }
    };

    mainChartContainerRef.current?.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      mainChartContainerRef.current?.removeEventListener('contextmenu', handleContextMenu);
      chart.remove();
    };
  }, []);

  // Fetch historical OHLCV data
  useEffect(() => {
    // Reset to initial load when interval changes
    isInitialLoadRef.current = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const rawData = await getOHLCVData(chainId, poolAddress, interval);
        if (rawData.length === 0) { setError('No data available'); setLoading(false); return; }

        const seenTimes = new Set<number>();
        const data = rawData
          .filter((d: OHLCVData) => { if (seenTimes.has(d.time)) return false; seenTimes.add(d.time); return true; })
          .sort((a: OHLCVData, b: OHLCVData) => a.time - b.time);

        const candleData: CandlestickData<Time>[] = data.map((d: OHLCVData) => ({
          time: d.time as Time, open: d.open, high: d.high, low: d.low, close: d.close,
        }));
        const volumeData: HistogramData<Time>[] = data.map((d: OHLCVData) => ({
          time: d.time as Time, value: d.volume,
          color: d.close >= d.open ? 'rgba(2, 192, 118, 0.5)' : 'rgba(246, 70, 93, 0.5)',
        }));

        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);

        // Only fit content on initial load, not on refresh (preserves user's zoom/pan)
        if (isInitialLoadRef.current) {
          mainChartRef.current?.timeScale().fitContent();
          isInitialLoadRef.current = false;
        }

        // Store last bar for real-time updates
        if (data.length > 0) {
          const lastData = data[data.length - 1];

          // CRITICAL FIX: Only update lastBarRef if we don't have a current bar,
          // or if the historical bar is newer than our current bar
          // This prevents overwriting live updates with stale historical data
          const shouldUpdate = !lastBarRef.current || lastBarRef.current.time < lastData.time;

          if (shouldUpdate) {
            lastBarRef.current = {
              time: lastData.time,
              open: lastData.open,
              high: lastData.high,
              low: lastData.low,
              close: lastData.close,
              volume: lastData.volume,
            };
            // Notify parent of initial price
            if (onPriceUpdate && lastData.close > 0) {
              onPriceUpdate(lastData.close);
            }
          }
        }
      } catch { setError('Failed to load chart data'); }
      setLoading(false);
    };

    fetchData();
    // Refresh historical data every 60 seconds (real-time updates handle current bar)
    const refreshInterval = window.setInterval(fetchData, 60000);
    return () => clearInterval(refreshInterval);
  }, [chainId, poolAddress, interval]);

  // Subscribe to real-time price updates for live K-line
  useEffect(() => {
    // CRITICAL FIX: Use poolAddress instead of baseTokenAddress
    // This ensures real-time updates use the same pool as historical data
    if (!poolAddress) return;

    const service = getRealtimeService();

    const handleOHLCVUpdate = (update: OHLCVUpdate) => {
      const { bar, isNewBar } = update;
      setIsLive(true);

      const candleSeries = candleSeriesRef.current;
      if (!candleSeries) return;

      const barData: CandlestickData<Time> = {
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      };

      // Use update() for real-time updates - it handles both new bars and updates
      candleSeries.update(barData);
      lastBarRef.current = bar;

      // Notify parent of price update for Order Book sync
      if (onPriceUpdate && bar.close > 0) {
        onPriceUpdate(bar.close);
      }
    };

    const unsubscribe = service.subscribeOHLCV(
      chainId,
      poolAddress,  // ✅ Changed from baseTokenAddress to poolAddress
      interval,
      lastBarRef.current,
      handleOHLCVUpdate
    );

    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, [chainId, poolAddress, interval]);  // ✅ Changed dependency from baseTokenAddress to poolAddress


  // Track current price for triggering large orders fetch
  const [currentChartPrice, setCurrentChartPrice] = useState<number>(0);

  // Update currentChartPrice when lastBar changes or data loads
  useEffect(() => {
    if (lastBarRef.current?.close && lastBarRef.current.close > 0) {
      setCurrentChartPrice(lastBarRef.current.close);
    }
  }, [loading]); // Trigger when loading finishes

  // Also update price from priceUsd prop if available (fallback for initial load)
  useEffect(() => {
    if (priceUsd && priceUsd > 0 && currentChartPrice === 0) {
      setCurrentChartPrice(priceUsd);
    }
  }, [priceUsd, currentChartPrice]);

  // Calculate precision options based on current price
  const precisionOptions = getPrecisionOptions(currentChartPrice || priceUsd || 1);
  const currentPrecision = precisionOptions[Math.min(ordersPrecisionIndex, precisionOptions.length - 1)] || 0.01;

  // Process raw order data from Order Book - aggregate using Chart's precision setting
  // Sort by price (closest to current price) and take top 5 from each side
  useEffect(() => {
    if (!showLargeOrders || !orderBookData) {
      setLargeOrders([]);
      return;
    }

    // Aggregate raw data using Chart's precision
    const aggregated = aggregateOrderData(orderBookData, currentPrecision);
    const { bids, asks } = aggregated;

    console.log(`[Chart] Orders precision: ${currentPrecision}, aggregated: ${bids.length} bids, ${asks.length} asks`);

    // Bids: sort by price descending (highest price = closest to current), take top 5
    const top5Bids: LargeOrder[] = [...bids]
      .sort((a, b) => b.price - a.price)  // Descending - highest price first
      .slice(0, 5)
      .map((bid, index) => ({
        price: bid.price,
        liquidityUSD: bid.liquidityUSD,
        type: 'bid' as const,
        rank: index + 1,  // 1 = closest to current price, 5 = farthest
      }));

    // Asks: sort by price ascending (lowest price = closest to current), take top 5
    const top5Asks: LargeOrder[] = [...asks]
      .sort((a, b) => a.price - b.price)  // Ascending - lowest price first
      .slice(0, 5)
      .map((ask, index) => ({
        price: ask.price,
        liquidityUSD: ask.liquidityUSD,
        type: 'ask' as const,
        rank: index + 1,  // 1 = closest to current price, 5 = farthest
      }));

    // Combine top 5 bids + top 5 asks = 10 lines max
    const orders = [...top5Bids, ...top5Asks];

    if (orders.length > 0) {
      maxLiquidityRef.current = Math.max(...orders.map(o => o.liquidityUSD));
    }

    setLargeOrders(orders);
  }, [orderBookData, showLargeOrders, currentPrecision]);

  // Attach OrderBook primitive to candlestick series (after chart initialization)
  useEffect(() => {
    // Wait a bit for chart to be fully initialized
    const timeout = setTimeout(() => {
      const candleSeries = candleSeriesRef.current;
      if (!candleSeries || orderBookPrimitiveRef.current) return;

      // Create and attach the primitive
      const primitive = new OrderBookBarsPrimitive();
      candleSeries.attachPrimitive(primitive);
      orderBookPrimitiveRef.current = primitive;
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (candleSeriesRef.current && orderBookPrimitiveRef.current) {
        candleSeriesRef.current.detachPrimitive(orderBookPrimitiveRef.current);
        orderBookPrimitiveRef.current = null;
      }
    };
  }, []);

  // Update order bars via primitive when largeOrders change
  useEffect(() => {
    const primitive = orderBookPrimitiveRef.current;
    if (!primitive) return;

    if (showLargeOrders && largeOrders.length > 0) {
      // Convert to OrderBookOrder format
      const orders = largeOrders.map(order => ({
        price: order.price,
        liquidityUSD: order.liquidityUSD,
        type: order.type,
        rank: order.rank,
      }));
      primitive.setOrders(orders);
    } else {
      primitive.clearOrders();
    }
  }, [largeOrders, showLargeOrders]);

  // Apply scale mode to chart
  useEffect(() => {
    const chart = mainChartRef.current;
    if (!chart) return;

    let mode: PriceScaleMode;
    switch (scaleMode) {
      case 'logarithmic':
        mode = PriceScaleMode.Logarithmic;
        break;
      case 'indexed':
        mode = PriceScaleMode.IndexedTo100;
        break;
      default:
        mode = PriceScaleMode.Normal;
    }

    chart.priceScale('right').applyOptions({ mode });
  }, [scaleMode]);

  // Fit content to view
  const handleFitContent = useCallback(() => {
    mainChartRef.current?.timeScale().fitContent();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scaleMenuRef.current && !scaleMenuRef.current.contains(e.target as Node)) {
        setShowScaleMenu(false);
        setScaleMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b border-[#30363d]">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm sm:text-lg font-semibold truncate max-w-[100px] sm:max-w-none">{symbol}</span>
          {loading && <span className="text-xs sm:text-sm text-gray-400 animate-pulse">Loading...</span>}
          {/* Live indicator */}
          {!loading && (
            <span className={`flex items-center gap-1 text-xs ${isLive ? 'text-green-500' : 'text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="hidden sm:inline">{isLive ? 'LIVE' : 'DELAYED'}</span>
            </span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Orders Toggle Button + Precision Selector */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowLargeOrders(!showLargeOrders)}
              className={`px-2 py-1 text-xs rounded-l border cursor-pointer ${
                showLargeOrders
                  ? 'bg-[#58a6ff]/20 text-[#58a6ff] border-[#58a6ff]/50'
                  : 'bg-[#21262d] text-[#c9d1d9] border-[#30363d] hover:bg-[#30363d]'
              }`}
              title="Toggle order book lines on chart"
            >
              Orders
            </button>
            {/* Precision Selector - only show when Orders is enabled */}
            {showLargeOrders && (
              <select
                value={ordersPrecisionIndex}
                onChange={(e) => setOrdersPrecisionIndex(parseInt(e.target.value))}
                className="text-xs px-1.5 py-1 bg-[#21262d] text-gray-300 rounded-r border border-l-0 border-[#58a6ff]/50 cursor-pointer hover:bg-[#30363d] focus:outline-none"
                title="Orders precision level"
              >
                {precisionOptions.map((precision, idx) => (
                  <option key={precision} value={idx}>
                    {formatPrecision(precision)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fit Content Button */}
          <button
            onClick={handleFitContent}
            className="px-2 py-1 text-xs rounded bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] flex items-center gap-1"
            title="Fit chart to screen (reset zoom)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="hidden sm:inline">Fit</span>
          </button>

          {/* Time intervals */}
          <div className="flex gap-0.5 sm:gap-1">
            {TIME_INTERVALS.map((ti) => (
              <button key={ti.value} onClick={() => setInterval(ti.value)}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded transition-colors ${
                  interval === ti.value ? 'bg-[#58a6ff] text-white' : 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]'
                }`}>{ti.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main chart */}
      <div className="relative flex-1 overflow-hidden">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 z-10">
            <div className="text-center">
              <p className="text-[#F6465D] mb-2">{error}</p>
              <p className="text-sm text-gray-400">This pool may not have OHLCV data available yet.</p>
            </div>
          </div>
        )}
        <div ref={mainChartContainerRef} className="w-full h-full" />

        {/* Right-click context menu for Y-axis scale mode */}
        {showScaleMenu && scaleMenuPosition && (
          <div
            ref={scaleMenuRef}
            className="fixed bg-[#21262d] border border-[#30363d] rounded shadow-lg z-50 min-w-[140px]"
            style={{ left: scaleMenuPosition.x, top: scaleMenuPosition.y }}
          >
            <div className="px-3 py-1.5 text-[10px] text-gray-500 border-b border-[#30363d]">Price Scale</div>
            {SCALE_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => {
                  setScaleMode(mode.value);
                  setShowScaleMenu(false);
                  setScaleMenuPosition(null);
                }}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-[#30363d] flex items-center gap-2 ${
                  scaleMode === mode.value ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'
                }`}
              >
                {scaleMode === mode.value && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={scaleMode === mode.value ? '' : 'ml-5'}>{mode.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Order Bars - rendered via Series Primitives (integrated into chart) */}

        {/* Trade Effect Overlay */}
        {showTradeEffect && (
          <>
            {/* Buy Effect: Green light beam crossing from right to left at current price */}
            {showTradeEffect === 'buy' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {/* Main beam - positioned at current price Y coordinate */}
                <div
                  className="absolute w-full h-1 animate-buy-beam"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', transform: tradeEffectY !== null ? 'translateY(-50%)' : 'translateY(-50%)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#02C076] to-transparent shadow-[0_0_20px_#02C076,0_0_40px_#02C076,0_0_60px_#02C076]" />
                </div>
                {/* Glow trail */}
                <div
                  className="absolute w-full h-8 animate-buy-beam opacity-30"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', transform: tradeEffectY !== null ? 'translateY(-50%)' : 'translateY(-50%)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#02C076] to-transparent blur-xl" />
                </div>
                {/* Vertical scanlines for effect */}
                <div className="absolute inset-0 animate-buy-flash opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#02C076]/0 via-[#02C076]/10 to-[#02C076]/0" />
                </div>
              </div>
            )}

            {/* Sell Effect: Red light beam from sell price going downward */}
            {showTradeEffect === 'sell' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {/* Main downward beam - full width, starts at sell price and moves down */}
                <div
                  className="absolute left-0 right-0 h-1 animate-sell-beam-down"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#F6465D] via-[#F6465D] to-[#F6465D] shadow-[0_0_30px_#F6465D,0_0_60px_#F6465D,0_0_90px_#F6465D]" />
                </div>
                {/* Glow trail following the beam */}
                <div
                  className="absolute left-0 right-0 h-12 animate-sell-beam-down opacity-40"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#F6465D] via-[#F6465D]/60 to-transparent blur-lg" />
                </div>
                {/* Secondary wider glow */}
                <div
                  className="absolute left-0 right-0 h-24 animate-sell-beam-down-delayed opacity-20"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#F6465D] via-[#F6465D]/30 to-transparent blur-2xl" />
                </div>
                {/* Flash effect on the whole chart */}
                <div className="absolute inset-0 animate-sell-flash opacity-10">
                  <div className="absolute inset-0 bg-[#F6465D]" />
                </div>
              </div>
            )}

            {/* CSS for trade effect animations */}
            <style jsx>{`
              @keyframes buy-beam {
                0% {
                  transform: translateX(100%);
                  opacity: 0;
                }
                5% {
                  opacity: 1;
                }
                95% {
                  opacity: 1;
                }
                100% {
                  transform: translateX(-100%);
                  opacity: 0;
                }
              }
              @keyframes buy-flash {
                0%, 100% {
                  opacity: 0;
                }
                50% {
                  opacity: 0.3;
                }
              }
              @keyframes sell-beam-down {
                0% {
                  transform: translateY(0);
                  opacity: 0;
                }
                5% {
                  opacity: 1;
                }
                85% {
                  opacity: 1;
                }
                100% {
                  transform: translateY(500px);
                  opacity: 0;
                }
              }
              @keyframes sell-beam-down-delayed {
                0% {
                  transform: translateY(0);
                  opacity: 0;
                }
                15% {
                  opacity: 0.2;
                }
                80% {
                  opacity: 0.2;
                }
                100% {
                  transform: translateY(500px);
                  opacity: 0;
                }
              }
              @keyframes sell-flash {
                0% {
                  opacity: 0;
                }
                10% {
                  opacity: 0.15;
                }
                30% {
                  opacity: 0.05;
                }
                100% {
                  opacity: 0;
                }
              }
              .animate-buy-beam {
                animation: buy-beam 4s ease-out forwards;
              }
              .animate-buy-flash {
                animation: buy-flash 2s ease-in-out;
              }
              .animate-sell-beam-down {
                animation: sell-beam-down 3s ease-in forwards;
              }
              .animate-sell-beam-down-delayed {
                animation: sell-beam-down-delayed 3.5s ease-in forwards;
              }
              .animate-sell-flash {
                animation: sell-flash 1.5s ease-out forwards;
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
