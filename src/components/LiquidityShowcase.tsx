'use client';

import { useState, useEffect, useRef } from 'react';

// Generate tick data
function generateTickData(currentPrice: number, tickCount: number = 20) {
  const ticks: { price: number; liquidity: number; side: 'bid' | 'ask' }[] = [];

  for (let i = 1; i <= tickCount; i++) {
    const priceOffset = currentPrice * (i * 0.005);
    ticks.push({
      price: currentPrice - priceOffset,
      liquidity: 500000 * Math.exp(-i * 0.15) * (0.5 + Math.random()),
      side: 'bid',
    });
    ticks.push({
      price: currentPrice + priceOffset,
      liquidity: 500000 * Math.exp(-i * 0.15) * (0.5 + Math.random()),
      side: 'ask',
    });
  }

  return ticks.sort((a, b) => b.price - a.price);
}

function formatK(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toFixed(0);
}

export default function LiquidityShowcase() {
  const [ticks, setTicks] = useState<{ price: number; liquidity: number; side: 'bid' | 'ask' }[]>([]);
  const [visible, setVisible] = useState({ a: false, b: false, c: false });
  const refA = useRef<HTMLDivElement>(null);
  const refB = useRef<HTMLDivElement>(null);
  const refC = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTicks(generateTickData(2847.32));
    const interval = setInterval(() => {
      setTicks(prev => prev.map(t => ({ ...t, liquidity: t.liquidity * (0.95 + Math.random() * 0.1) })));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-id');
          if (entry.isIntersecting && id) {
            setVisible(prev => ({ ...prev, [id]: true }));
          }
        });
      },
      { threshold: 0.3 }
    );

    [refA, refB, refC].forEach(ref => ref.current && observer.observe(ref.current));
    return () => observer.disconnect();
  }, []);

  const maxLiq = Math.max(...ticks.map(t => t.liquidity), 1);
  const bids = ticks.filter(t => t.side === 'bid').slice(0, 8);
  const asks = ticks.filter(t => t.side === 'ask').slice(0, 8);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Card 1: Order Book */}
      <div ref={refA} data-id="a" className={`bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 transition-all duration-500 ${visible.a ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="text-xs text-gray-500 mb-1">Order Book</div>
        <div className="text-sm font-medium mb-3">Bid/Ask Depth</div>

        <div className="space-y-px">
          {asks.slice(0, 4).reverse().map((t, i) => (
            <div key={`a-${i}`} className="relative h-5 flex items-center text-[10px] font-mono">
              <div className="absolute left-0 h-full bg-red-500/10" style={{ width: `${(t.liquidity / maxLiq) * 100}%` }} />
              <div className="relative flex justify-between w-full px-1.5">
                <span className="text-red-400">{t.price.toFixed(2)}</span>
                <span className="text-gray-500">${formatK(t.liquidity)}</span>
              </div>
            </div>
          ))}
          <div className="h-5 flex items-center justify-center text-[10px] text-gray-400 border-y border-[#1a1a1a] my-0.5">
            $2,847.32
          </div>
          {bids.slice(0, 4).map((t, i) => (
            <div key={`b-${i}`} className="relative h-5 flex items-center text-[10px] font-mono">
              <div className="absolute right-0 h-full bg-green-500/10" style={{ width: `${(t.liquidity / maxLiq) * 100}%` }} />
              <div className="relative flex justify-between w-full px-1.5">
                <span className="text-green-500">{t.price.toFixed(2)}</span>
                <span className="text-gray-500">${formatK(t.liquidity)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: Tick Chart */}
      <div ref={refB} data-id="b" className={`bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 transition-all duration-500 delay-100 ${visible.b ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="text-xs text-gray-500 mb-1">Tick Distribution</div>
        <div className="text-sm font-medium mb-3">Liquidity per Price</div>

        <div className="h-28 flex items-end gap-[2px]">
          {ticks.slice(0, 30).map((t, i) => {
            const h = (t.liquidity / maxLiq) * 100;
            return (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all duration-300 ${t.side === 'bid' ? 'bg-green-500/60' : 'bg-red-400/60'}`}
                style={{ height: visible.b ? `${h}%` : '0%', transitionDelay: `${i * 15}ms` }}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[10px] text-gray-500 mt-2">
          <span>-10%</span>
          <span>Current</span>
          <span>+10%</span>
        </div>
      </div>

      {/* Card 3: Heatmap */}
      <div ref={refC} data-id="c" className={`bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-4 transition-all duration-500 delay-200 ${visible.c ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="text-xs text-gray-500 mb-1">Heatmap</div>
        <div className="text-sm font-medium mb-3">Depth Intensity</div>

        <div className="grid grid-cols-6 gap-1">
          {ticks.slice(0, 24).map((t, i) => {
            const intensity = t.liquidity / maxLiq;
            const color = t.side === 'bid' ? '34, 197, 94' : '239, 68, 68';
            return (
              <div
                key={i}
                className={`aspect-square rounded transition-all duration-200 ${visible.c ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                style={{
                  backgroundColor: `rgba(${color}, ${0.15 + intensity * 0.7})`,
                  boxShadow: intensity > 0.5 ? `0 0 8px rgba(${color}, 0.4)` : 'none',
                  transitionDelay: `${i * 20}ms`,
                }}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <div className="h-1.5 flex-1 rounded bg-gradient-to-r from-green-500/20 to-green-500" />
          <span className="text-[10px] text-gray-500">Liquidity</span>
        </div>
      </div>
    </div>
  );
}
