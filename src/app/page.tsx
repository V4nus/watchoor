'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import dynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { Waves, Activity, TrendingDown, ArrowRight, Anchor, Compass, ArrowDown } from 'lucide-react';

const OceanBackground = dynamic(() => import('@/components/OceanBackground'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#0a1929]" />,
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-[200vh] relative">
      {/* Full-page Ocean Background */}
      {mounted && <OceanBackground />}

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Header - floating at top */}
        <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6 backdrop-blur-md bg-[#0a1929]/30 border-b border-white/5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="0xArgus" className="h-7" />
            </Link>
            <nav className="flex items-center gap-6">
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

        {/* Hero Section - "Surface" of the ocean */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20">
          {/* Submarine icon at top */}
          <div
            className="mb-8 opacity-80"
            style={{ transform: `translateY(${scrollY * 0.1}px)` }}
          >
            <div className="relative">
              {/* Sonar ping */}
              <div className="absolute inset-0 animate-ping opacity-30">
                <div className="w-16 h-16 rounded-full border-2 border-[#3fb950]" />
              </div>
              <div className="w-16 h-16 rounded-full bg-[#3fb950]/20 border border-[#3fb950]/50 flex items-center justify-center">
                <Anchor className="w-8 h-8 text-[#3fb950]" />
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/5 text-[#38bdf8] text-sm backdrop-blur-sm">
              <Waves size={16} className="animate-pulse" />
              {t.home.tagline}
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-center text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="text-white drop-shadow-lg">{t.home.heroTitle}</span>
            <br />
            <span className="bg-gradient-to-r from-[#38bdf8] via-[#3fb950] to-[#38bdf8] bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              {t.home.heroHighlight}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-gray-300/80 text-lg sm:text-xl mb-10 max-w-2xl text-center leading-relaxed">
            {t.home.heroSubtitle}
          </p>

          {/* Search Box */}
          <div className="w-full max-w-xl mb-10">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#38bdf8]/30 via-[#3fb950]/30 to-[#38bdf8]/30 rounded-xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-[#30363d]/50">
                <SearchBox />
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="mt-8 animate-bounce text-[#38bdf8]/60">
            <ArrowDown size={24} />
          </div>
        </section>

        {/* Depth Comparison Section - As you scroll, you dive deeper */}
        <section className="min-h-screen px-6 py-20">
          <div className="max-w-6xl mx-auto">
            {/* Section title */}
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                {t.home.depthScanner}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Not all pools are created equal. Dive deep to discover the truth.
              </p>
            </div>

            {/* Comparison Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* Dangerous Pool */}
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

              {/* Healthy Pool */}
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

            {/* Features Row */}
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

        {/* Quick Links Section */}
        <section className="px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-xl font-semibold text-white mb-6">{t.home.ctaExplore}</h3>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <QuickLink
                label="PEPE/WETH"
                chain="ETH"
                href="/pool/ethereum/0xa43fe16908251ee70ef74718545e4fe6c5ccec9f"
              />
              <QuickLink
                label="DEGEN/WETH"
                chain="Base"
                href="/pool/base/0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa"
              />
              <QuickLink
                label="BRETT/WETH"
                chain="Base"
                href="/pool/base/0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8"
              />
            </div>
          </div>
        </section>

        {/* Bottom Stats */}
        <footer className="px-6 py-12 border-t border-white/5 bg-[#030a12]/50 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
              <StatItem value="6+" label={t.home.chains} icon={<Compass size={18} />} />
              <StatItem value="12K+" label={t.home.pools} icon={<Waves size={18} />} />
              <StatItem value="$2.4B" label={t.common.liquidity} icon={<Anchor size={18} />} />
              <StatItem value="<5s" label={t.home.latency} icon={<Activity size={18} />} />
            </div>
          </div>
        </footer>
      </div>

      {/* CSS for animations */}
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
      className="relative rounded-2xl border backdrop-blur-xl overflow-hidden transition-transform hover:scale-[1.02]"
      style={{
        backgroundColor: 'rgba(13, 17, 23, 0.8)',
        borderColor: `${color}30`,
      }}
    >
      {/* Depth indicator bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />

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
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: bgColor, color }}
          >
            {depth}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Market Cap */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Market Cap</span>
              <span className="text-white font-mono">{mcap}</span>
            </div>
            <div className="h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500/60 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Liquidity */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Real Liquidity</span>
              <span className="font-mono" style={{ color }}>{liquidity}</span>
            </div>
            <div className="h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(ratio * 1.5, 100)}%`, backgroundColor: color }}
              />
            </div>
          </div>

          {/* Ratio */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-gray-400 text-sm">Liquidity Ratio</span>
            <span className="text-2xl font-bold" style={{ color }}>
              {ratio}%
            </span>
          </div>

          {/* Impact warning */}
          <div
            className="p-3 rounded-lg text-sm"
            style={{ backgroundColor: bgColor }}
          >
            <span style={{ color }}>{impact}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl bg-[#0d1117]/60 backdrop-blur-xl border border-[#30363d]/50 hover:border-[#3fb950]/30 transition-colors">
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
      className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 hover:border-[#3fb950]/50 bg-[#0d1117]/60 backdrop-blur-xl hover:bg-[#3fb950]/10 transition-all duration-300"
    >
      <span className="text-white group-hover:text-[#3fb950] transition-colors font-medium">
        {label}
      </span>
      <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors px-2 py-0.5 rounded bg-white/5">
        {chain}
      </span>
      <ArrowRight size={16} className="text-gray-600 group-hover:text-[#3fb950] group-hover:translate-x-1 transition-all" />
    </Link>
  );
}

function StatItem({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[#38bdf8]/60">{icon}</div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
