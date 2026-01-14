'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { ArrowRight, TrendingDown, ArrowUpRight, Zap, Shield, BarChart3 } from 'lucide-react';

// Demo token data
const DEMO_TOKENS = {
  hype: {
    symbol: 'HYPE',
    name: 'Hype Token',
    mcap: 100000000,
    liquidity: 500000,
    price: 0.0234,
    change: 847.5,
    color: '#ef4444',
  },
  solid: {
    symbol: 'SOLID',
    name: 'Solid Token',
    mcap: 3000000,
    liquidity: 2000000,
    price: 0.0089,
    change: 12.3,
    color: '#22c55e',
  },
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeToken, setActiveToken] = useState<'hype' | 'solid'>('hype');
  const [sellAmount, setSellAmount] = useState(10000);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  const token = DEMO_TOKENS[activeToken];
  const priceImpact = calculatePriceImpact(sellAmount, token.liquidity);
  const priceAfterSell = token.price * (1 - priceImpact / 100);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0a0a0f]" />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-7" />
          </Link>
          <nav className="flex items-center gap-4">
            <a
              href="https://github.com/V4nus/0xArgus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              GitHub
            </a>
            <a
              href="https://x.com/0xArgus_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Twitter
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-white">Market cap lies.</span>
              <br />
              <span className="text-gray-500">Liquidity doesn't.</span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl">
              See the real trading capacity of any token. Discover how much you can actually buy or sell before moving the price.
            </p>
            <div className="max-w-xl">
              <SearchBox />
            </div>
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Try it yourself</h2>
            <p className="text-gray-500">Select a token and see how a $10K sell would affect the price</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Token Selector Cards */}
            <div className="space-y-4">
              <TokenCard
                token={DEMO_TOKENS.hype}
                isActive={activeToken === 'hype'}
                onClick={() => setActiveToken('hype')}
                label="High MCAP, Low Liquidity"
              />
              <TokenCard
                token={DEMO_TOKENS.solid}
                isActive={activeToken === 'solid'}
                onClick={() => setActiveToken('solid')}
                label="Low MCAP, High Liquidity"
              />
            </div>

            {/* Impact Simulator */}
            <div className="bg-[#111116] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Price Impact Simulator</h3>
                <div
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${token.color}15`,
                    color: token.color
                  }}
                >
                  {token.symbol}
                </div>
              </div>

              {/* Sell Amount Slider */}
              <div className="mb-8">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-gray-400">Sell Amount</span>
                  <span className="text-white font-mono">${sellAmount.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, ${token.color} 0%, ${token.color} ${(sellAmount - 1000) / 990}%, rgba(255,255,255,0.1) ${(sellAmount - 1000) / 990}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>$1K</span>
                  <span>$100K</span>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                {/* Price Impact */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingDown size={18} className="text-gray-500" />
                      <span className="text-gray-400">Price Impact</span>
                    </div>
                    <span
                      className="text-2xl font-bold font-mono"
                      style={{ color: priceImpact > 5 ? '#ef4444' : priceImpact > 1 ? '#f59e0b' : '#22c55e' }}
                    >
                      -{priceImpact.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Price Before/After */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 rounded-xl p-4">
                    <div className="text-gray-500 text-sm mb-1">Price Before</div>
                    <div className="text-white font-mono text-lg">${token.price.toFixed(4)}</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4">
                    <div className="text-gray-500 text-sm mb-1">Price After</div>
                    <div className="font-mono text-lg" style={{ color: token.color }}>
                      ${priceAfterSell.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Liquidity Ratio */}
                <div className="bg-black/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400">Liquidity / Market Cap</span>
                    <span className="font-mono" style={{ color: token.color }}>
                      {((token.liquidity / token.mcap) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min((token.liquidity / token.mcap) * 100, 100)}%`,
                        backgroundColor: token.color
                      }}
                    />
                  </div>
                </div>

                {/* Verdict */}
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    backgroundColor: `${token.color}08`,
                    borderColor: `${token.color}30`
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${token.color}20` }}
                    >
                      {activeToken === 'hype' ? '⚠️' : '✓'}
                    </div>
                    <div>
                      <div className="font-semibold mb-1" style={{ color: token.color }}>
                        {activeToken === 'hype' ? 'High Risk - Shallow Liquidity' : 'Healthy - Deep Liquidity'}
                      </div>
                      <div className="text-sm text-gray-400">
                        {activeToken === 'hype'
                          ? `Despite $100M market cap, only $500K is available to trade. Large orders will cause significant slippage.`
                          : `Strong liquidity ratio of 66.7%. The pool can absorb large trades with minimal price impact.`
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Depth Visualization */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="bg-[#111116] rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Liquidity Depth Comparison</h3>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-gray-400">HYPE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-400">SOLID</span>
                </div>
              </div>
            </div>

            <DepthChart activeToken={activeToken} />
          </div>
        </section>

        {/* Features */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid sm:grid-cols-3 gap-6">
            <FeatureCard
              icon={<BarChart3 className="w-5 h-5" />}
              title="Real-time Depth Analysis"
              description="See the actual liquidity at every price level, not just surface metrics"
            />
            <FeatureCard
              icon={<Zap className="w-5 h-5" />}
              title="Instant Price Impact"
              description="Calculate exactly how your trade will move the market"
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="Risk Assessment"
              description="Identify tokens with healthy liquidity vs dangerous imbalances"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white mb-6">Explore Real Pools</h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <QuickLink label="PEPE/WETH" chain="ETH" href="/pool/ethereum/0xa43fe16908251ee70ef74718545e4fe6c5ccec9f" />
              <QuickLink label="DEGEN/WETH" chain="Base" href="/pool/base/0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa" />
              <QuickLink label="BRETT/WETH" chain="Base" href="/pool/base/0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-gray-600 text-sm">
          <p>0xArgus - See the real depth of DeFi liquidity</p>
        </div>
      </footer>

      <style jsx global>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

function calculatePriceImpact(sellAmount: number, liquidity: number): number {
  // Simplified AMM price impact formula
  // In reality this depends on the AMM curve, but this gives a good approximation
  const k = 2; // constant product factor
  return (sellAmount / liquidity) * 100 * k;
}

function TokenCard({
  token,
  isActive,
  onClick,
  label
}: {
  token: typeof DEMO_TOKENS.hype;
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  const ratio = (token.liquidity / token.mcap) * 100;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-xl border transition-all ${
        isActive
          ? 'bg-white/5 border-white/20'
          : 'bg-[#111116] border-white/5 hover:border-white/10'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style={{
              backgroundColor: `${token.color}15`,
              color: token.color
            }}
          >
            {token.symbol[0]}
          </div>
          <div>
            <div className="font-semibold text-white">{token.symbol}</div>
            <div className="text-sm text-gray-500">{token.name}</div>
          </div>
        </div>
        <div
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isActive ? 'border-white bg-white' : 'border-gray-600'
          }`}
        >
          {isActive && <div className="w-2 h-2 rounded-full bg-black" />}
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-3">{label}</div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-500 mb-1">Market Cap</div>
          <div className="text-white font-mono">${formatNumber(token.mcap)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Liquidity</div>
          <div className="font-mono" style={{ color: token.color }}>
            ${formatNumber(token.liquidity)}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Liquidity Ratio</span>
          <span className="font-mono font-semibold" style={{ color: token.color }}>
            {ratio.toFixed(1)}%
          </span>
        </div>
      </div>
    </button>
  );
}

function DepthChart({ activeToken }: { activeToken: 'hype' | 'solid' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Generate depth data
    const generateDepth = (liquidity: number, levels: number) => {
      const data: number[] = [];
      for (let i = 0; i < levels; i++) {
        // Exponential decay from center
        const distFromCenter = Math.abs(i - levels / 2) / (levels / 2);
        const value = liquidity * Math.exp(-distFromCenter * 3) * (0.8 + Math.random() * 0.4);
        data.push(value);
      }
      return data;
    };

    const hypeDepth = generateDepth(500000, 50);
    const solidDepth = generateDepth(2000000, 50);

    const maxValue = Math.max(...solidDepth);

    // Draw SOLID depth (green) - only if active or as comparison
    ctx.beginPath();
    ctx.moveTo(0, height);
    solidDepth.forEach((value, i) => {
      const x = (width / (solidDepth.length - 1)) * i;
      const y = height - (value / maxValue) * height * 0.9;
      if (i === 0) ctx.moveTo(x, height);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = activeToken === 'solid' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.1)';
    ctx.fill();

    // Draw SOLID line
    ctx.beginPath();
    solidDepth.forEach((value, i) => {
      const x = (width / (solidDepth.length - 1)) * i;
      const y = height - (value / maxValue) * height * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = activeToken === 'solid' ? '#22c55e' : 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = activeToken === 'solid' ? 2 : 1;
    ctx.stroke();

    // Draw HYPE depth (red)
    ctx.beginPath();
    ctx.moveTo(0, height);
    hypeDepth.forEach((value, i) => {
      const x = (width / (hypeDepth.length - 1)) * i;
      const y = height - (value / maxValue) * height * 0.9;
      if (i === 0) ctx.moveTo(x, height);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = activeToken === 'hype' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.1)';
    ctx.fill();

    // Draw HYPE line
    ctx.beginPath();
    hypeDepth.forEach((value, i) => {
      const x = (width / (hypeDepth.length - 1)) * i;
      const y = height - (value / maxValue) * height * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = activeToken === 'hype' ? '#ef4444' : 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = activeToken === 'hype' ? 2 : 1;
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Current Price', width / 2, 15);
    ctx.fillText('← Bids (Buy Support)', width * 0.25, height - 10);
    ctx.fillText('Asks (Sell Pressure) →', width * 0.75, height - 10);

  }, [activeToken]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-64"
      style={{ width: '100%', height: '256px' }}
    />
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-[#111116] border border-white/5">
      <div className="text-gray-400 mb-4">{icon}</div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function QuickLink({ label, chain, href }: { label: string; chain: string; href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all"
    >
      <span className="text-white font-medium">{label}</span>
      <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-white/5">{chain}</span>
      <ArrowUpRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
    </Link>
  );
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
  return num.toString();
}
