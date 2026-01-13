'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { Waves, Activity, TrendingDown, ArrowRight, Anchor, Compass, ArrowDown } from 'lucide-react';

const OceanBackground = dynamic(() => import('@/components/OceanBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#0a1929]" />,
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-[200vh] relative">
      {/* Turbulent Ocean Background */}
      {mounted && <OceanBackground />}

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Header - floating */}
        <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <img src="/logo.svg" alt="0xArgus" className="h-6" />
            </Link>
            <nav className="flex items-center gap-4">
              <a
                href="https://github.com/V4nus/0xArgus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors text-sm bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"
              >
                GitHub
              </a>
              <a
                href="https://x.com/0xArgus_"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors text-sm bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10"
              >
                Twitter
              </a>
              <div className="bg-black/30 backdrop-blur-md rounded-full border border-white/10">
                <LanguageSwitcher />
              </div>
            </nav>
          </div>
        </header>

        {/* Hero Section - Above the waves */}
        <section className="min-h-screen flex flex-col items-center justify-start px-6 pt-32">
          {/* Main content card - floating above ocean */}
          <div className="w-full max-w-3xl">
            {/* Glowing card */}
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#3fb950]/20 via-[#38bdf8]/20 to-[#3fb950]/20 rounded-3xl blur-xl opacity-60" />

              <div className="relative bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-8 sm:p-12">
                {/* Tagline */}
                <div className="flex justify-center mb-6">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#3fb950]/40 bg-[#3fb950]/10 text-[#3fb950] text-sm font-medium">
                    <Waves size={16} className="animate-pulse" />
                    {t.home.tagline}
                  </span>
                </div>

                {/* Main Title */}
                <h1 className="text-center text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  <span className="text-white">{t.home.heroTitle}</span>
                  <br />
                  <span className="bg-gradient-to-r from-[#38bdf8] via-[#3fb950] to-[#38bdf8] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                    {t.home.heroHighlight}
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-gray-300/90 text-lg mb-8 text-center leading-relaxed max-w-2xl mx-auto">
                  {t.home.heroSubtitle}
                </p>

                {/* Search Box */}
                <div className="max-w-xl mx-auto">
                  <SearchBox />
                </div>

                {/* Quick stats */}
                <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-4 gap-4">
                  <MiniStat value="6+" label={t.home.chains} />
                  <MiniStat value="12K+" label={t.home.pools} />
                  <MiniStat value="$2.4B" label={t.common.liquidity} />
                  <MiniStat value="<5s" label={t.home.latency} />
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="mt-12 flex flex-col items-center text-white/40">
              <span className="text-sm mb-2">Scroll to explore</span>
              <ArrowDown size={20} className="animate-bounce" />
            </div>
          </div>
        </section>

        {/* Depth Analysis Section */}
        <section className="px-6 py-24">
          <div className="max-w-6xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8] text-sm font-medium mb-4">
                <Anchor size={16} />
                {t.home.depthScanner}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                See Beyond Market Cap
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Market cap tells you size. Liquidity tells you truth.
              </p>
            </div>

            {/* Comparison cards */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              <DepthCard
                type="danger"
                symbol="HYPE"
                name="Hype Token"
                mcap="$100,000,000"
                liquidity="$500,000"
                ratio={0.5}
                impact="Selling $10K = ~20% price drop"
                depth="Shallow Waters"
              />
              <DepthCard
                type="healthy"
                symbol="SOLID"
                name="Solid Token"
                mcap="$3,000,000"
                liquidity="$2,000,000"
                ratio={66.7}
                impact="Selling $10K = ~0.5% price drop"
                depth="Deep Ocean"
              />
            </div>

            {/* Feature cards */}
            <div className="grid sm:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Anchor className="w-6 h-6" />}
                title={t.home.featureDepth}
                description={t.home.featureDepthDesc}
              />
              <FeatureCard
                icon={<Activity className="w-6 h-6" />}
                title={t.home.featureRealTime}
                description={t.home.featureRealTimeDesc}
              />
              <FeatureCard
                icon={<TrendingDown className="w-6 h-6" />}
                title={t.home.featureImpact}
                description={t.home.featureImpactDesc}
              />
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-xl font-semibold text-white mb-6">{t.home.ctaExplore}</h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <QuickLink label="PEPE/WETH" chain="ETH" href="/pool/ethereum/0xa43fe16908251ee70ef74718545e4fe6c5ccec9f" />
              <QuickLink label="DEGEN/WETH" chain="Base" href="/pool/base/0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa" />
              <QuickLink label="BRETT/WETH" chain="Base" href="/pool/base/0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8" />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 border-t border-white/5 bg-black/30 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
            <p>0xArgus - Dive into liquidity depth</p>
          </div>
        </footer>
      </div>

      {/* CSS */}
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 4s ease infinite;
        }
      `}</style>
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl sm:text-2xl font-bold text-[#3fb950]">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

function DepthCard({
  type,
  symbol,
  name,
  mcap,
  liquidity,
  ratio,
  impact,
  depth,
}: {
  type: 'danger' | 'healthy';
  symbol: string;
  name: string;
  mcap: string;
  liquidity: string;
  ratio: number;
  impact: string;
  depth: string;
}) {
  const isDanger = type === 'danger';
  const color = isDanger ? '#ef4444' : '#22c55e';
  const bgColor = isDanger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';

  return (
    <div
      className="relative rounded-2xl border backdrop-blur-xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-2xl"
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderColor: `${color}40`,
      }}
    >
      {/* Side indicator */}
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: bgColor, color }}
            >
              {symbol[0]}
            </div>
            <div>
              <div className="text-white font-bold text-lg">{symbol}</div>
              <div className="text-gray-500 text-sm">{name}</div>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: bgColor, color }}>
            {depth}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Market Cap</span>
              <span className="text-white font-mono">{mcap}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500/60 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Real Liquidity</span>
              <span className="font-mono" style={{ color }}>{liquidity}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(ratio * 1.5, 100)}%`, backgroundColor: color }} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-gray-400 text-sm">Liquidity Ratio</span>
            <span className="text-2xl font-bold" style={{ color }}>{ratio}%</span>
          </div>

          <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: bgColor }}>
            <span style={{ color }}>{impact}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 hover:border-[#3fb950]/30 transition-colors">
      <div className="text-[#3fb950] mb-4">{icon}</div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function QuickLink({ label, chain, href }: { label: string; chain: string; href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 hover:border-[#3fb950]/50 bg-black/40 backdrop-blur-xl hover:bg-[#3fb950]/10 transition-all duration-300"
    >
      <span className="text-white group-hover:text-[#3fb950] transition-colors font-medium">{label}</span>
      <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-white/5">{chain}</span>
      <ArrowRight size={16} className="text-gray-600 group-hover:text-[#3fb950] group-hover:translate-x-1 transition-all" />
    </Link>
  );
}
