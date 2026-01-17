'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Github, Database, Zap, Globe, LineChart, Layers, Code2, Server, Shield, BookOpen, GitBranch, Waves } from 'lucide-react';

// 文档卡片数据
const DOC_CARDS = [
  {
    id: 'uniswap',
    title: 'Uniswap 解析原理',
    description: 'V2 恒定乘积、V3 集中流动性、V4 单例架构的流动性解析',
    icon: GitBranch,
    color: '#a855f7',
    href: '/wiki/uniswap',
  },
  {
    id: 'solana',
    title: 'Solana 解析原理',
    description: 'Raydium、Orca、Meteora、PumpSwap 等 DEX 协议解析',
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
              <span className="text-sm">首页</span>
            </Link>
            <span className="text-gray-600">|</span>
            <h1 className="text-lg font-medium">0xArgus 技术文档</h1>
          </div>
          <a
            href="https://github.com/V4nus/0xArgus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Github size={18} />
          </a>
        </div>
      </header>

      <main className="pt-20 pb-16 px-6 max-w-5xl mx-auto">
        {/* 项目概览 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <BookOpen className="text-[#22c55e]" size={24} />
            项目概览
          </h2>
          <p className="text-gray-300 mb-6 text-lg">
            <span className="text-[#22c55e] font-semibold">0xArgus</span> 是一个 AMM 流动性分析平台，将流动性池转换为订单簿深度显示，揭示隐藏的支撑位和阻力位。
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '框架', value: 'Next.js 16' },
              { label: '语言', value: 'TypeScript 5' },
              { label: '数据库', value: 'PostgreSQL' },
              { label: '代码规模', value: '20,000+ 行' },
            ].map((item) => (
              <div key={item.label} className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
                <p className="text-gray-500 text-sm">{item.label}</p>
                <p className="text-white font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 解析原理文档卡片 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Code2 className="text-[#22c55e]" size={24} />
            解析原理
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

        {/* 技术栈 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Layers className="text-[#22c55e]" size={24} />
            技术栈
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="font-medium mb-3 text-[#22c55e]">前端</h3>
              <div className="flex flex-wrap gap-2">
                {['React 19', 'Next.js 16', 'TailwindCSS', 'Three.js', 'lightweight-charts'].map((t) => (
                  <span key={t} className="px-2 py-1 bg-[#1a1a1a] rounded text-sm text-gray-300">{t}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <h3 className="font-medium mb-3 text-[#22c55e]">区块链</h3>
              <div className="flex flex-wrap gap-2">
                {['viem', 'wagmi', 'ethers', '@solana/web3.js', 'Uniswap SDK'].map((t) => (
                  <span key={t} className="px-2 py-1 bg-[#1a1a1a] rounded text-sm text-gray-300">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 支持的链 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Globe className="text-[#22c55e]" size={24} />
            支持的链
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

        {/* 系统架构 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <Server className="text-[#22c55e]" size={24} />
            系统架构
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

        {/* API & 数据库 */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="text-[#22c55e]" size={20} />
              核心 API
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                {[
                  { path: '/api/liquidity-depth', desc: '流动性深度' },
                  { path: '/api/ohlcv', desc: 'K 线数据' },
                  { path: '/api/trades', desc: '交易历史' },
                  { path: '/api/uniswap-quote', desc: '报价引擎' },
                  { path: '/api/trending', desc: '趋势池' },
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
              数据模型
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                {[
                  { name: 'Pool', desc: '池元数据' },
                  { name: 'LPPosition', desc: 'LP 头寸' },
                  { name: 'OHLCVCandle', desc: 'K 线数据' },
                  { name: 'LiquiditySnapshot', desc: '流动性快照' },
                  { name: 'V4Trade', desc: 'V4 交易事件' },
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

        {/* 实时数据 & 安全 */}
        <div className="grid md:grid-cols-2 gap-6">
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <LineChart className="text-[#22c55e]" size={20} />
              实时更新
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between"><span className="text-gray-400">价格</span><span className="text-[#22c55e]">1 秒</span></li>
                <li className="flex justify-between"><span className="text-gray-400">流动性深度</span><span className="text-[#22c55e]">6 秒</span></li>
                <li className="flex justify-between"><span className="text-gray-400">K 线</span><span className="text-[#22c55e]">10 秒</span></li>
                <li className="flex justify-between"><span className="text-gray-400">交易历史</span><span className="text-[#22c55e]">5 秒</span></li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="text-[#22c55e]" size={20} />
              安全特性
            </h2>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-5">
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• Slippage 保护 (可配置)</li>
                <li>• CoW Protocol MEV 保护</li>
                <li>• Permit2 标准化签名</li>
                <li>• API 输入验证 & 速率限制</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="border-t border-[#1a1a1a] mt-12 pt-6">
          <p className="text-center text-gray-500 text-sm">© 2024 0xArgus. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
