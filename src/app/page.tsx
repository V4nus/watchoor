'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

const ParticleField = dynamic(() => import('@/components/ParticleField'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black" />
  ),
});

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* 3D Particle Background */}
      {mounted && <ParticleField />}

      {/* Content Overlay */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Minimal Header */}
        <header className="py-6 px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-8" />
          </Link>
          <nav className="flex items-center gap-6">
            <a
              href="https://github.com/V4nus/0xArgus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm"
            >
              GitHub
            </a>
            <a
              href="https://x.com/0xArgus_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm"
            >
              Twitter
            </a>
            <LanguageSwitcher />
          </nav>
        </header>

        {/* Hero Section - Centered */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-20">
          {/* Main Title */}
          <div className="text-center max-w-4xl">
            {/* Tagline */}
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#3fb950]/30 bg-[#3fb950]/5 text-[#3fb950] text-sm">
                <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
                {t.home.tagline}
              </span>
            </div>

            {/* Gradient Title */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight tracking-tight">
              <span className="text-white">{t.home.title1}</span>
              <br />
              <span className="bg-gradient-to-r from-[#3fb950] via-[#58d68d] to-[#3fb950] bg-clip-text text-transparent">
                {t.home.title2}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-gray-400 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
              {t.home.subtitle}
            </p>

            {/* Search Box */}
            <div className="max-w-xl mx-auto mb-8">
              <div className="relative group">
                {/* Glow effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-[#3fb950]/20 via-[#3fb950]/10 to-[#3fb950]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <SearchBox />
                </div>
              </div>
            </div>

            {/* Quick Links */}
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
        </main>

        {/* Bottom Stats Bar */}
        <footer className="py-8 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              <StatItem value="6+" label={t.home.chains} />
              <StatItem value="12K+" label={t.home.pools} />
              <StatItem value="$2.4B" label={t.common.liquidity} />
              <StatItem value="<5s" label={t.home.latency} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function QuickLink({ label, chain, href }: { label: string; chain: string; href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:border-[#3fb950]/50 bg-white/5 hover:bg-[#3fb950]/10 transition-all duration-300"
    >
      <span className="text-white group-hover:text-[#3fb950] transition-colors font-medium">
        {label}
      </span>
      <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
        {chain}
      </span>
    </Link>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold text-[#3fb950]">{value}</div>
      <div className="text-xs sm:text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
