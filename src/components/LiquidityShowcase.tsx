'use client';

import { useState, useEffect } from 'react';

// Generate liquidity range data
function generateLiquidityRanges() {
  const ranges: { priceMin: number; priceMax: number; liquidity: number; active: boolean }[] = [];
  const currentPrice = 2847;

  for (let i = -15; i <= 15; i++) {
    const priceMin = currentPrice * (1 + i * 0.012);
    const priceMax = currentPrice * (1 + (i + 1) * 0.012);
    const distance = Math.abs(i);
    const liquidity = 800000 * Math.exp(-distance * 0.18) * (0.6 + Math.random() * 0.8);
    ranges.push({
      priceMin,
      priceMax,
      liquidity,
      active: i === 0,
    });
  }
  return ranges;
}

// Generate order book data
function generateOrderBook(currentPrice: number) {
  const orders: { price: number; size: number; side: 'bid' | 'ask'; depth: number }[] = [];

  let bidDepth = 0;
  for (let i = 1; i <= 12; i++) {
    const size = 30000 + Math.random() * 150000;
    bidDepth += size;
    orders.push({
      price: currentPrice - i * 8 - Math.random() * 3,
      size,
      side: 'bid',
      depth: bidDepth,
    });
  }

  let askDepth = 0;
  for (let i = 1; i <= 12; i++) {
    const size = 30000 + Math.random() * 150000;
    askDepth += size;
    orders.push({
      price: currentPrice + i * 8 + Math.random() * 3,
      size,
      side: 'ask',
      depth: askDepth,
    });
  }

  return orders;
}

function formatK(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toFixed(0);
}

export default function LiquidityShowcase() {
  const [liquidityRanges, setLiquidityRanges] = useState<ReturnType<typeof generateLiquidityRanges>>([]);
  const [orderBook, setOrderBook] = useState<ReturnType<typeof generateOrderBook>>([]);

  useEffect(() => {
    setLiquidityRanges(generateLiquidityRanges());
    setOrderBook(generateOrderBook(2847));

    const interval = setInterval(() => {
      setLiquidityRanges(generateLiquidityRanges());
      setOrderBook(generateOrderBook(2847));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const maxLiquidity = Math.max(...liquidityRanges.map(r => r.liquidity), 1);
  const maxDepth = Math.max(...orderBook.map(o => o.depth), 1);

  const bids = orderBook.filter(o => o.side === 'bid').sort((a, b) => b.price - a.price);
  const asks = orderBook.filter(o => o.side === 'ask').sort((a, b) => a.price - b.price);

  return (
    <div className="bg-[#0a0a0a]">

      {/* Section 1: Liquidity Distribution - Full screen height */}
      <section className="min-h-screen flex flex-col justify-center py-20 border-b border-[#151515]">
        <div className="w-full">
          {/* Header */}
          <div className="max-w-7xl mx-auto px-6 mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-3">Liquidity Distribution</h2>
            <p className="text-gray-500 text-lg">Concentrated liquidity across price ticks</p>
          </div>

          {/* Chart - Full width */}
          <div className="w-full px-6 sm:px-12 lg:px-20">
            {/* Price labels */}
            <div className="flex justify-between text-sm text-gray-600 mb-4">
              <span>$2,200</span>
              <span className="text-green-500 font-medium">Current: $2,847</span>
              <span>$3,500</span>
            </div>

            {/* Liquidity bars */}
            <div className="h-[50vh] min-h-[300px] max-h-[500px] flex items-end gap-[2px]">
              {liquidityRanges.map((range, i) => {
                const height = (range.liquidity / maxLiquidity) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm relative group cursor-crosshair transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${height}%`,
                      background: range.active
                        ? 'linear-gradient(to top, rgba(34, 197, 94, 0.95), rgba(34, 197, 94, 0.4))'
                        : 'linear-gradient(to top, rgba(59, 130, 246, 0.7), rgba(59, 130, 246, 0.15))',
                      boxShadow: range.active ? '0 0 30px rgba(34, 197, 94, 0.4)' : 'none',
                    }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl">
                        <div className="text-gray-400 mb-1">${range.priceMin.toFixed(0)} - ${range.priceMax.toFixed(0)}</div>
                        <div className="text-white font-semibold text-sm">${formatK(range.liquidity)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-8 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-blue-500/70" />
                <span className="text-gray-400">Liquidity Range</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-green-500" />
                <span className="text-gray-400">Active Tick</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Order Book - Full screen */}
      <section className="min-h-screen flex flex-col justify-center py-20">
        <div className="w-full">
          {/* Header */}
          <div className="max-w-7xl mx-auto px-6 mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-3">Order Book Depth</h2>
            <p className="text-gray-500 text-lg">Real-time bid/ask liquidity visualization</p>
          </div>

          {/* Order Book Content */}
          <div className="px-6 sm:px-12 lg:px-20">
            {/* Price Display */}
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">$2,847.32</div>
                <div className="text-sm text-gray-500">Spread: 0.02%</div>
              </div>
            </div>

            {/* Three column layout: Bids | Divider | Asks */}
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
              {/* Bids (left side) */}
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-500 mb-4 px-2">
                  <span className="uppercase tracking-wider font-medium">Bids</span>
                  <span>Total: ${formatK(bids.reduce((s, b) => s + b.size, 0))}</span>
                </div>
                <div className="space-y-[2px]">
                  {bids.slice(0, 12).map((order, i) => {
                    const widthPercent = (order.depth / maxDepth) * 100;
                    return (
                      <div key={`bid-${i}`} className="relative h-10 flex items-center">
                        <div
                          className="absolute left-0 h-full bg-gradient-to-r from-green-500/40 to-green-500/5 transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                        <div className="relative flex justify-between w-full px-4 font-mono text-sm">
                          <span className="text-green-500 font-medium">${order.price.toFixed(2)}</span>
                          <span className="text-gray-400">{formatK(order.size)}</span>
                          <span className="text-gray-600">{formatK(order.depth)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Asks (right side) */}
              <div className="flex-1">
                <div className="flex justify-between text-xs text-gray-500 mb-4 px-2">
                  <span className="uppercase tracking-wider font-medium">Asks</span>
                  <span>Total: ${formatK(asks.reduce((s, a) => s + a.size, 0))}</span>
                </div>
                <div className="space-y-[2px]">
                  {asks.slice(0, 12).map((order, i) => {
                    const widthPercent = (order.depth / maxDepth) * 100;
                    return (
                      <div key={`ask-${i}`} className="relative h-10 flex items-center">
                        <div
                          className="absolute right-0 h-full bg-gradient-to-l from-red-500/40 to-red-500/5 transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                        <div className="relative flex justify-between w-full px-4 font-mono text-sm">
                          <span className="text-gray-600">{formatK(order.depth)}</span>
                          <span className="text-gray-400">{formatK(order.size)}</span>
                          <span className="text-red-400 font-medium">${order.price.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-8 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-green-500/70" />
                <span className="text-gray-400">Buy Orders</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-red-500/70" />
                <span className="text-gray-400">Sell Orders</span>
              </div>
              <span className="text-gray-600">Price • Size • Cumulative Depth</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
