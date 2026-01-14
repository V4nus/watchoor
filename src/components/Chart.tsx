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

export type TradeEffectType = 'buy' | 'sell' | null;

interface ChartProps {
  chainId: string;
  poolAddress: string;
  symbol: string;
  priceUsd?: number;
  baseTokenAddress?: string;
  quoteTokenAddress?: string;
  tradeEffect?: TradeEffectType;
  onTradeEffectComplete?: () => void;
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
  baseTokenAddress,
  tradeEffect,
  onTradeEffectComplete,
}: ChartProps) {
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lastBarRef = useRef<RealtimeBar | null>(null);

  const [interval, setInterval] = useState<TimeInterval>('1h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scaleMode, setScaleMode] = useState<ScaleMode>('regular');
  const [showScaleMenu, setShowScaleMenu] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const scaleMenuRef = useRef<HTMLDivElement>(null);
  const [showTradeEffect, setShowTradeEffect] = useState<'buy' | 'sell' | null>(null);
  const [tradeEffectY, setTradeEffectY] = useState<number | null>(null);

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
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#3fb950', downColor: '#f85149',
      borderUpColor: '#3fb950', borderDownColor: '#f85149',
      wickUpColor: '#3fb950', wickDownColor: '#f85149',
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
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
  }, []);

  // Fetch historical OHLCV data
  useEffect(() => {
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
          color: d.close >= d.open ? 'rgba(63, 185, 80, 0.5)' : 'rgba(248, 81, 73, 0.5)',
        }));

        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);
        mainChartRef.current?.timeScale().fitContent();

        // Store last bar for real-time updates
        if (data.length > 0) {
          const lastData = data[data.length - 1];
          lastBarRef.current = {
            time: lastData.time,
            open: lastData.open,
            high: lastData.high,
            low: lastData.low,
            close: lastData.close,
            volume: lastData.volume,
          };
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
    if (!baseTokenAddress) return;

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
    };

    const unsubscribe = service.subscribeOHLCV(
      chainId,
      baseTokenAddress,
      interval,
      lastBarRef.current,
      handleOHLCVUpdate
    );

    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, [chainId, baseTokenAddress, interval]);

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
          {/* Scale Mode Dropdown - hidden on very small screens */}
          <div className="relative hidden sm:block" ref={scaleMenuRef}>
            <button
              onClick={() => setShowScaleMenu(!showScaleMenu)}
              className="px-2 py-1 text-xs rounded bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] flex items-center gap-1"
              title="Price scale mode"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {SCALE_MODES.find(s => s.value === scaleMode)?.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showScaleMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#21262d] border border-[#30363d] rounded shadow-lg z-20 min-w-[120px]">
                {SCALE_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => { setScaleMode(mode.value); setShowScaleMenu(false); }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-[#30363d] ${
                      scaleMode === mode.value ? 'text-[#58a6ff]' : 'text-[#c9d1d9]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
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
      <div className="relative flex-1">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 z-10">
            <div className="text-center">
              <p className="text-[#f85149] mb-2">{error}</p>
              <p className="text-sm text-gray-400">This pool may not have OHLCV data available yet.</p>
            </div>
          </div>
        )}
        <div ref={mainChartContainerRef} className="w-full h-full" />

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
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#3fb950] to-transparent shadow-[0_0_20px_#3fb950,0_0_40px_#3fb950,0_0_60px_#3fb950]" />
                </div>
                {/* Glow trail */}
                <div
                  className="absolute w-full h-8 animate-buy-beam opacity-30"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', transform: tradeEffectY !== null ? 'translateY(-50%)' : 'translateY(-50%)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#3fb950] to-transparent blur-xl" />
                </div>
                {/* Vertical scanlines for effect */}
                <div className="absolute inset-0 animate-buy-flash opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#3fb950]/0 via-[#3fb950]/10 to-[#3fb950]/0" />
                </div>
              </div>
            )}

            {/* Sell Effect: Red light beam from current price going downward */}
            {showTradeEffect === 'sell' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                {/* Main horizontal beam at current price - similar to buy but red and crosses left to right */}
                <div
                  className="absolute w-full h-1 animate-sell-beam-horizontal"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', transform: 'translateY(-50%)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#f85149] to-transparent shadow-[0_0_20px_#f85149,0_0_40px_#f85149,0_0_60px_#f85149]" />
                </div>
                {/* Glow trail */}
                <div
                  className="absolute w-full h-8 animate-sell-beam-horizontal opacity-30"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', transform: 'translateY(-50%)' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#f85149] to-transparent blur-xl" />
                </div>
                {/* Downward particle effect from the price level */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-2 animate-sell-drop"
                  style={{ top: tradeEffectY !== null ? `${tradeEffectY}px` : '50%', height: '200px' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-[#f85149] via-[#f85149]/50 to-transparent shadow-[0_0_15px_#f85149]" />
                </div>
                {/* Horizontal scanlines for effect */}
                <div className="absolute inset-0 animate-sell-flash opacity-20">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#f85149]/0 via-[#f85149]/10 to-[#f85149]/0" />
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
              @keyframes sell-beam-horizontal {
                0% {
                  transform: translateX(-100%);
                  opacity: 0;
                }
                5% {
                  opacity: 1;
                }
                95% {
                  opacity: 1;
                }
                100% {
                  transform: translateX(100%);
                  opacity: 0;
                }
              }
              @keyframes sell-drop {
                0% {
                  transform: translateY(0) translateX(-50%);
                  opacity: 0;
                }
                10% {
                  opacity: 1;
                }
                80% {
                  opacity: 0.8;
                }
                100% {
                  transform: translateY(150px) translateX(-50%);
                  opacity: 0;
                }
              }
              @keyframes sell-flash {
                0%, 100% {
                  opacity: 0;
                }
                50% {
                  opacity: 0.3;
                }
              }
              .animate-buy-beam {
                animation: buy-beam 4s ease-out forwards;
              }
              .animate-buy-flash {
                animation: buy-flash 2s ease-in-out;
              }
              .animate-sell-beam-horizontal {
                animation: sell-beam-horizontal 4s ease-out forwards;
              }
              .animate-sell-drop {
                animation: sell-drop 3s ease-out forwards;
              }
              .animate-sell-flash {
                animation: sell-flash 2s ease-in-out;
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
