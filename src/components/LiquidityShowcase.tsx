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
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTicks(generateTickData(2847.32));
    const interval = setInterval(() => {
      setTicks(prev => prev.map(t => ({ ...t, liquidity: t.liquidity * (0.95 + Math.random() * 0.1) })));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const containerHeight = containerRef.current.offsetHeight;

      // Calculate scroll progress (0 to 1) through the entire showcase
      const scrolled = -rect.top;
      const totalScrollable = containerHeight - windowHeight;
      const progress = Math.max(0, Math.min(1, scrolled / totalScrollable));

      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const maxLiq = Math.max(...ticks.map(t => t.liquidity), 1);
  const bids = ticks.filter(t => t.side === 'bid').slice(0, 10);
  const asks = ticks.filter(t => t.side === 'ask').slice(0, 10);

  // Section progress (each section is 1/3 of total)
  const section1Progress = Math.min(1, scrollProgress * 3);
  const section2Progress = Math.max(0, Math.min(1, (scrollProgress - 0.33) * 3));
  const section3Progress = Math.max(0, Math.min(1, (scrollProgress - 0.66) * 3));

  return (
    <div ref={containerRef} className="relative" style={{ height: '400vh' }}>
      {/* Sticky container for Apple-like scroll effect */}
      <div className="sticky top-0 h-screen overflow-hidden bg-[#0a0a0a]">
        {/* Background gradient that shifts */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: `radial-gradient(ellipse at ${50 + scrollProgress * 20}% ${50 - scrollProgress * 30}%, rgba(34, 197, 94, 0.08) 0%, transparent 50%)`,
          }}
        />

        {/* Section 1: Order Book with 3D perspective */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{
            opacity: section1Progress < 0.7 ? 1 : 1 - (section1Progress - 0.7) / 0.3,
            transform: `
              perspective(1200px)
              translateZ(${section1Progress > 0.7 ? -(section1Progress - 0.7) * 500 : 0}px)
              translateY(${section1Progress > 0.7 ? -(section1Progress - 0.7) * 100 : 0}px)
            `,
            pointerEvents: section1Progress > 0.9 ? 'none' : 'auto',
          }}
        >
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text with stagger animation */}
            <div
              className="transition-all duration-700"
              style={{
                opacity: Math.min(1, section1Progress * 2),
                transform: `translateX(${(1 - Math.min(1, section1Progress * 2)) * -50}px)`,
              }}
            >
              <span className="text-green-500 font-mono text-sm tracking-widest">01</span>
              <h2
                className="text-5xl lg:text-6xl font-bold mt-4 mb-6 leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Real-time<br />Order Book
              </h2>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                Bid/Ask depth visualization from concentrated liquidity pools.
                See exactly where the liquidity sits.
              </p>
              <div className="mt-8 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                  <span className="text-sm text-gray-400">Bids</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  <span className="text-sm text-gray-400">Asks</span>
                </div>
              </div>
            </div>

            {/* Right: 3D Order Book Card */}
            <div
              className="transition-all duration-500"
              style={{
                opacity: Math.min(1, section1Progress * 2),
                transform: `
                  perspective(1000px)
                  rotateY(${(1 - Math.min(1, section1Progress * 1.5)) * -15}deg)
                  rotateX(${(1 - Math.min(1, section1Progress * 1.5)) * 5}deg)
                  translateX(${(1 - Math.min(1, section1Progress * 2)) * 100}px)
                  scale(${0.9 + Math.min(1, section1Progress * 1.5) * 0.1})
                `,
              }}
            >
              <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#627eea] to-[#3b5998] flex items-center justify-center text-lg font-bold shadow-lg shadow-[#627eea]/30">Ξ</div>
                    <div>
                      <span className="font-semibold text-lg">ETH/USDC</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">V3</span>
                        <span className="text-xs text-gray-500">Uniswap</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-gray-500">Live</span>
                  </div>
                </div>

                <div className="space-y-1">
                  {asks.slice(0, 5).reverse().map((t, i) => (
                    <div key={`a-${i}`} className="relative h-9 flex items-center text-sm font-mono rounded-lg overflow-hidden">
                      <div
                        className="absolute left-0 h-full bg-gradient-to-r from-red-500/20 to-red-500/5 transition-all duration-500"
                        style={{
                          width: `${(t.liquidity / maxLiq) * 100}%`,
                          transitionDelay: `${i * 50}ms`,
                        }}
                      />
                      <div className="relative flex justify-between w-full px-3">
                        <span className="text-red-400">${t.price.toFixed(2)}</span>
                        <span className="text-gray-500">{formatK(t.liquidity)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="h-12 flex items-center justify-center text-xl font-bold text-white border-y border-[#222] my-2 bg-gradient-to-r from-transparent via-white/5 to-transparent">
                    $2,847.32
                  </div>
                  {bids.slice(0, 5).map((t, i) => (
                    <div key={`b-${i}`} className="relative h-9 flex items-center text-sm font-mono rounded-lg overflow-hidden">
                      <div
                        className="absolute right-0 h-full bg-gradient-to-l from-green-500/20 to-green-500/5 transition-all duration-500"
                        style={{
                          width: `${(t.liquidity / maxLiq) * 100}%`,
                          transitionDelay: `${i * 50}ms`,
                        }}
                      />
                      <div className="relative flex justify-between w-full px-3">
                        <span className="text-green-500">${t.price.toFixed(2)}</span>
                        <span className="text-gray-500">{formatK(t.liquidity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Tick Distribution */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{
            opacity: section2Progress > 0.1 && section2Progress < 0.9 ? 1 : section2Progress <= 0.1 ? section2Progress * 10 : 1 - (section2Progress - 0.9) * 10,
            transform: `
              perspective(1200px)
              translateZ(${section2Progress < 0.1 ? (0.1 - section2Progress) * 500 : section2Progress > 0.9 ? -(section2Progress - 0.9) * 500 : 0}px)
              scale(${section2Progress < 0.1 ? 0.8 + section2Progress * 2 : section2Progress > 0.9 ? 1 - (section2Progress - 0.9) : 1})
            `,
            pointerEvents: section2Progress < 0.1 || section2Progress > 0.9 ? 'none' : 'auto',
          }}
        >
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: 3D Bar Chart */}
            <div
              className="order-2 lg:order-1 transition-all duration-500"
              style={{
                transform: `
                  perspective(1000px)
                  rotateY(${section2Progress > 0.1 ? Math.min(1, (section2Progress - 0.1) * 2) * 5 : 0}deg)
                  rotateX(${section2Progress > 0.1 ? Math.min(1, (section2Progress - 0.1) * 2) * -3 : 0}deg)
                `,
              }}
            >
              <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-6 shadow-2xl shadow-black/50">
                <div className="h-72 flex items-end gap-1 perspective-[1000px]">
                  {ticks.slice(0, 40).map((t, i) => {
                    const h = (t.liquidity / maxLiq) * 100;
                    const isVisible = section2Progress > 0.2;
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all duration-700 transform-gpu"
                        style={{
                          height: isVisible ? `${h}%` : '0%',
                          background: t.side === 'bid'
                            ? `linear-gradient(to top, rgba(34, 197, 94, 0.8), rgba(34, 197, 94, 0.3))`
                            : `linear-gradient(to top, rgba(239, 68, 68, 0.8), rgba(239, 68, 68, 0.3))`,
                          boxShadow: isVisible && h > 50
                            ? `0 0 20px ${t.side === 'bid' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
                            : 'none',
                          transitionDelay: `${i * 15}ms`,
                          transform: `rotateX(${isVisible ? 0 : -90}deg)`,
                          transformOrigin: 'bottom',
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm text-gray-500 mt-4 px-2">
                  <span>-10%</span>
                  <span className="text-green-500 font-medium">Current Price</span>
                  <span>+10%</span>
                </div>
              </div>
            </div>

            {/* Right: Text */}
            <div className="order-1 lg:order-2">
              <span className="text-green-500 font-mono text-sm tracking-widest">02</span>
              <h2
                className="text-5xl lg:text-6xl font-bold mt-4 mb-6 leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Tick<br />Distribution
              </h2>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                Visualize liquidity concentration across price ranges in V3/V4 pools.
              </p>
              <ul className="mt-8 space-y-4 text-gray-400">
                {['Each bar = one price tick', 'Height = liquidity depth', 'Real-time chain updates'].map((text, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 transition-all duration-500"
                    style={{
                      opacity: section2Progress > 0.3 + i * 0.1 ? 1 : 0,
                      transform: `translateX(${section2Progress > 0.3 + i * 0.1 ? 0 : 20}px)`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Section 3: Heatmap */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{
            opacity: section3Progress > 0.1 ? 1 : section3Progress * 10,
            transform: `
              perspective(1200px)
              translateZ(${section3Progress < 0.1 ? (0.1 - section3Progress) * 500 : 0}px)
              scale(${section3Progress < 0.1 ? 0.8 + section3Progress * 2 : 1})
            `,
            pointerEvents: section3Progress < 0.1 ? 'none' : 'auto',
          }}
        >
          <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <div>
              <span className="text-green-500 font-mono text-sm tracking-widest">03</span>
              <h2
                className="text-5xl lg:text-6xl font-bold mt-4 mb-6 leading-tight"
                style={{
                  background: 'linear-gradient(135deg, #fff 0%, #888 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Depth<br />Heatmap
              </h2>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                Visual intensity mapping of liquidity density.
                Spot concentration zones instantly.
              </p>
              <div className="mt-8">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-40 rounded-full bg-gradient-to-r from-[#0a2010] via-green-500 to-green-300 shadow-lg shadow-green-500/20" />
                  <span className="text-sm text-gray-400">Intensity</span>
                </div>
              </div>
            </div>

            {/* Right: 3D Heatmap Grid */}
            <div
              className="transition-all duration-500"
              style={{
                transform: `
                  perspective(1000px)
                  rotateY(${section3Progress > 0.2 ? -8 : 0}deg)
                  rotateX(${section3Progress > 0.2 ? 5 : 0}deg)
                `,
              }}
            >
              <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-2xl p-6 shadow-2xl shadow-black/50">
                <div className="grid grid-cols-8 gap-2">
                  {ticks.slice(0, 32).map((t, i) => {
                    const intensity = t.liquidity / maxLiq;
                    const color = t.side === 'bid' ? '34, 197, 94' : '239, 68, 68';
                    const isVisible = section3Progress > 0.3;
                    return (
                      <div
                        key={i}
                        className="aspect-square rounded-xl transition-all duration-500 transform-gpu"
                        style={{
                          backgroundColor: `rgba(${color}, ${isVisible ? 0.15 + intensity * 0.6 : 0})`,
                          boxShadow: isVisible && intensity > 0.5
                            ? `0 0 30px rgba(${color}, 0.5), inset 0 0 20px rgba(${color}, 0.2)`
                            : 'none',
                          transform: `
                            scale(${isVisible ? 1 : 0.5})
                            translateZ(${isVisible ? intensity * 20 : 0}px)
                          `,
                          opacity: isVisible ? 1 : 0,
                          transitionDelay: `${i * 25}ms`,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col gap-4">
          {[0, 1, 2].map((i) => {
            const sectionProgress = i === 0 ? section1Progress : i === 1 ? section2Progress : section3Progress;
            const isActive = sectionProgress > 0.2 && sectionProgress < 0.8;
            return (
              <div key={i} className="relative">
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${isActive ? 'bg-green-500 scale-150' : 'bg-gray-600'}`}
                  style={{
                    boxShadow: isActive ? '0 0 20px rgba(34, 197, 94, 0.8)' : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Scroll hint at bottom */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-opacity duration-500"
          style={{ opacity: scrollProgress < 0.1 ? 1 : 0 }}
        >
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <span className="text-xs">Scroll to explore</span>
            <div className="w-6 h-10 rounded-full border-2 border-gray-600 p-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
