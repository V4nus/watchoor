'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Github, Database, Zap, Globe, LineChart, Layers, Code2, Server, Shield, BookOpen, GitBranch, Waves } from 'lucide-react';

// Documentation cards
const DOC_CARDS = [
  {
    id: 'uniswap',
    title: 'Uniswap Liquidity Analysis',
    description: 'V2 constant product, V3 concentrated liquidity, V4 singleton architecture',
    icon: GitBranch,
    color: '#a855f7',
    href: '/wiki/uniswap',
  },
  {
    id: 'solana',
    title: 'Solana DEX Analysis',
    description: 'Raydium, Orca, Meteora, PumpSwap protocol parsing',
    icon: Waves,
    color: '#06b6d4',
    href: '/wiki/solana',
  },
];

export default function WikiPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
              <span className="text-sm">Home</span>
            </Link>
            <span className="text-gray-600">|</span>
            <h1 className="text-lg font-medium">Watchoor Technical Documentation</h1>
          </div>
          <a
            href="https://github.com/V4nus/watchoor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Github size={18} />
          </a>
        </div>
      </header>

      <main className="pt-20 pb-16 px-6 max-w-5xl mx-auto">
        {/* Project Overview */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <BookOpen className="text-[#22c55e]" size={24} />
            Project Overview
          </h2>
          <p className="text-gray-300 mb-6 text-lg">
            <span className="text-[#22c55e] font-semibold">Watchoor</span> is an AMM liquidity analysis platform that transforms liquidity pools into order book depth displays, revealing hidden support and resistance levels.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Framework', value: 'Next.js 16' },
              { label: 'Language', value: 'TypeScript 5' },
              { label: 'Database', value: 'PostgreSQL' },
              { label: 'Codebase', value: '20,000+ lines' },
            ].map((item) => (
              <div key={item.label} className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
                <p className="text-gray-500 text-sm">{item.label}</p>
                <p className="text-white font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Analysis Documentation Cards */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Code2 className="text-[#22c55e]" size={24} />
            Analysis Principles
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {DOC_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className="group bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 hover:border-[#22c55e]/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <Icon size={32} style={{ color: card.color }} />
                    <ArrowRight size={20} className="text-gray-600 group-hover:text-[#22c55e] transition-colors" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
                  <p className="text-gray-400 text-sm">{card.description}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Layers className="text-[#22c55e]" size={24} />
            Tech Stack
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="font-medium mb-3 text-[#22c55e]">Frontend</h3>
              <div className="flex flex-wrap gap-2">
                {['React 19', 'Next.js 16', 'TailwindCSS', 'Three.js', 'lightweight-charts'].map((t) => (
                  <span key={t} className="px-2 py-1 bg-[#1a1a1a] rounded text-sm text-gray-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="font-medium mb-3 text-[#22c55e]">Blockchain</h3>
              <div className="flex flex-wrap gap-2">
                {['viem', 'wagmi', 'ethers', '@solana/web3.js', 'Uniswap SDK'].map((t) => (
                  <span key={t} className="px-2 py-1 bg-[#1a1a1a] rounded text-sm text-gray-300">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Supported Chains */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Globe className="text-[#22c55e]" size={24} />
            Supported Chains
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Ethereum', versions: 'V2/V3', icon: '/chains/ethereum.png' },
              { name: 'Base', versions: 'V2/V3/V4', icon: '/chains/base.svg' },
              { name: 'BNB Chain', versions: 'V2/V3', icon: '/chains/bsc.svg' },
              { name: 'Solana', versions: 'Multi-DEX', icon: '/chains/solana.png' },
            ].map((chain) => (
              <div key={chain.name} className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-3">
                <img src={chain.icon} alt={chain.name} className="w-8 h-8" />
                <div>
                  <p className="font-medium">{chain.name}</p>
                  <p className="text-xs text-gray-500">{chain.versions}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* System Architecture */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Server className="text-[#22c55e]" size={24} />
            System Architecture
          </h2>
          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 overflow-x-auto">
            <pre className="text-xs sm:text-sm text-gray-300">
{`┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│   Chart │ LiquidityDepth │ TradePanel │ OceanBackground     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    API Layer (Next.js)                       │
│   /liquidity-depth │ /ohlcv │ /trades │ /uniswap-quote      │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Business Logic                            │
│   liquidity.ts │ solana-liquidity.ts │ cow.ts │ realtime.ts │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│   PostgreSQL │ DexScreener │ GeckoTerminal │ RPC Nodes      │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </section>

        {/* API & Database */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="text-[#22c55e]" size={20} />
              Core APIs
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                {[
                  { path: '/api/liquidity-depth', desc: 'Liquidity Depth' },
                  { path: '/api/ohlcv', desc: 'Candlestick Data' },
                  { path: '/api/trades', desc: 'Trade History' },
                  { path: '/api/uniswap-quote', desc: 'Quote Engine' },
                  { path: '/api/trending', desc: 'Trending Pools' },
                ].map((api) => (
                  <li key={api.path} className="flex justify-between">
                    <code className="text-[#22c55e]">{api.path}</code>
                    <span className="text-gray-500">{api.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Database className="text-[#22c55e]" size={20} />
              Data Models
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                {[
                  { name: 'Pool', desc: 'Pool Metadata' },
                  { name: 'LPPosition', desc: 'LP Positions' },
                  { name: 'OHLCVCandle', desc: 'Candlestick Data' },
                  { name: 'LiquiditySnapshot', desc: 'Liquidity Snapshots' },
                  { name: 'V4Trade', desc: 'V4 Trade Events' },
                ].map((model) => (
                  <li key={model.name} className="flex justify-between">
                    <code className="text-[#22c55e]">{model.name}</code>
                    <span className="text-gray-500">{model.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        {/* Real-time & Security */}
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <LineChart className="text-[#22c55e]" size={20} />
              Real-time Updates
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-gray-400">Price</span><span className="text-[#22c55e]">1 second</span></li>
                <li className="flex justify-between"><span className="text-gray-400">Liquidity Depth</span><span className="text-[#22c55e]">6 seconds</span></li>
                <li className="flex justify-between"><span className="text-gray-400">Candlesticks</span><span className="text-[#22c55e]">10 seconds</span></li>
                <li className="flex justify-between"><span className="text-gray-400">Trade History</span><span className="text-[#22c55e]">5 seconds</span></li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="text-[#22c55e]" size={20} />
              Security Features
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Configurable Slippage Protection</li>
                <li>• CoW Protocol MEV Protection</li>
                <li>• Permit2 Standardized Signatures</li>
                <li>• API Input Validation & Rate Limiting</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1a1a1a] mt-12 pt-6">
          <p className="text-center text-gray-500 text-sm">© 2024 Watchoor. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
