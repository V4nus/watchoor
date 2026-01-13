'use client';

import SearchBox from '@/components/SearchBox';
import { SUPPORTED_CHAINS } from '@/types';
import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const HeroVideo = dynamic(() => import('@/components/HeroVideo'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-[#161b22] rounded-xl border border-[#30363d] flex items-center justify-center">
      <div className="text-gray-400 animate-pulse">Loading visualization...</div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0d12] relative overflow-hidden">
      {/* Dynamic Backgrounds - Layered */}
      <NetworkNodes />
      <div className="fixed inset-0 grid-bg opacity-30" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[#3fb950]/8 blur-[120px] rounded-full" />

      {/* Header */}
      <header className="relative z-10 border-b border-[#1a2332] bg-[#0d1117]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-2xl font-bold text-[#3fb950] glow-green">FlowLens</span>
              <span className="absolute -top-1 -right-8 text-[10px] px-1.5 py-0.5 bg-[#3fb950] text-black rounded font-bold animate-pulse">LIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiveClock />
            <div className="w-px h-6 bg-[#30363d] mx-2" />
            {SUPPORTED_CHAINS.slice(0, 5).map((chain) => (
              <span
                key={chain.id}
                className="w-8 h-8 flex items-center justify-center bg-[#161b22] rounded text-sm hover:bg-[#3fb950]/20 hover:scale-110 border border-[#30363d] hover:border-[#3fb950]/50 transition-all cursor-pointer"
                title={chain.name}
              >
                {chain.icon}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Hero */}
        <div className="py-8 md:py-12">
          {/* Hero Text - Centered */}
          <div className="text-center mb-8">
            <TerminalText />

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              <TypewriterText text="Decode AMM" />
              <br />
              <span className="text-[#3fb950] glow-green">
                <TypewriterText text="Into Order Flow" delay={1500} />
              </span>
            </h1>

            <p className="text-gray-400 mb-6 text-lg max-w-2xl mx-auto">
              Transform any AMM liquidity into real-time order book depth
            </p>

            <div className="max-w-xl mx-auto glow-green-box rounded-lg mb-6">
              <SearchBox />
            </div>

            {/* Popular Pools */}
            <div className="flex flex-wrap gap-2 justify-center">
              <PoolTag label="PEPE" chain="ETH" change="+12.4%" href="/pool/ethereum/0xa43fe16908251ee70ef74718545e4fe6c5ccec9f" />
              <PoolTag label="DEGEN" chain="Base" change="-3.2%" href="/pool/base/0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa" />
              <PoolTag label="BRETT" chain="Base" change="+8.7%" href="/pool/base/0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8" />
            </div>
          </div>

          {/* Hero Video - Full Width */}
          <div className="mt-8">
            <HeroVideo />
          </div>
        </div>

        {/* Live Data Ticker */}
        <div className="py-8 border-t border-[#1a2332]">
          <LiveDataTicker />
        </div>

        {/* Features */}
        <div className="py-12 border-t border-[#1a2332]">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              <span className="text-[#3fb950]">&lt;</span> Core Features <span className="text-[#3fb950]">/&gt;</span>
            </h2>
            <p className="text-gray-500">A new perspective on on-chain liquidity</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<OrderBookIcon />}
              title="Real-Time Order Book"
              desc="AMM liquidity converted to Bid/Ask depth, refreshed every 5 seconds"
              stat="< 5s"
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Chart Overlay"
              desc="Support and resistance levels displayed directly on price charts"
              stat="ALL AMM"
            />
            <FeatureCard
              icon={<WalletIcon />}
              title="LP Tracking"
              desc="Track every LP position's adds, removes, and adjustments"
              stat="LIVE"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="py-12 border-t border-[#1a2332]">
          <div className="grid grid-cols-4 gap-6">
            <AnimatedStat value={6} suffix="+" label="Chains" />
            <AnimatedStat value={12847} label="Pools Analyzed" />
            <AnimatedStat value={2.4} suffix="B" prefix="$" label="Total Liquidity" />
            <AnimatedStat value={5} suffix="s" label="Update Latency" />
          </div>
        </div>

        {/* How It Works */}
        <div className="py-12 border-t border-[#1a2332]">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white">How It Works</h2>
          </div>
          <div className="flex items-center justify-center gap-4">
            <ProcessStep step={1} label="Read On-Chain Ticks" active />
            <ProcessArrow />
            <ProcessStep step={2} label="Calculate Depth" />
            <ProcessArrow />
            <ProcessStep step={3} label="Generate Order Book" />
            <ProcessArrow />
            <ProcessStep step={4} label="Real-Time Updates" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1a2332] py-6 mt-12 bg-[#0d1117]/80">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] pulse-dot" />
            <span className="text-[#3fb950] font-mono">System Online</span>
          </div>
          <span className="text-gray-600 font-mono">// Powered by On-Chain Data</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// NETWORK NODES - Blockchain Network Effect
// ============================================
function NetworkNodes() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      pulsePhase: number;
    }

    const nodes: Node[] = [];
    const nodeCount = 20;

    // Initialize nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // Update nodes
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;
        node.pulsePhase += 0.02;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;
      });

      // Draw connections
      ctx.strokeStyle = 'rgba(63, 185, 80, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.globalAlpha = (1 - dist / 200) * 0.3;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw data packets traveling on connections
      ctx.globalAlpha = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const progress = ((frame + i * 20) % 100) / 100;
            const packetX = nodes[i].x + (nodes[j].x - nodes[i].x) * progress;
            const packetY = nodes[i].y + (nodes[j].y - nodes[i].y) * progress;

            ctx.fillStyle = '#3fb950';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(packetX, packetY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw nodes
      nodes.forEach((node) => {
        const pulse = Math.sin(node.pulsePhase) * 0.3 + 0.7;
        ctx.globalAlpha = pulse * 0.5;

        // Glow
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4);
        gradient.addColorStop(0, 'rgba(63, 185, 80, 0.3)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#3fb950';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-50" />;
}

// ============================================
// UTILITY COMPONENTS
// ============================================

function LiveClock() {
  const [time, setTime] = useState('--:--:--');

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-sm text-[#3fb950]">
      {time}
    </div>
  );
}

function TerminalText() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#161b22] border border-[#30363d] rounded-lg mb-6 font-mono text-sm">
      <span className="text-[#3fb950]">❯</span>
      <span className="text-gray-400">analyzing</span>
      <span className="text-white">liquidity_pools</span>
      <span className="animate-pulse text-[#3fb950]">█</span>
    </div>
  );
}

function TypewriterText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimeout = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [text, started]);

  return <>{displayed}<span className="animate-pulse">|</span></>;
}

function LiveDataTicker() {
  const trades = [
    { pair: 'PEPE/WETH', type: 'BUY', amount: '$12.4K', time: '2s ago' },
    { pair: 'DEGEN/WETH', type: 'SELL', amount: '$8.2K', time: '5s ago' },
    { pair: 'BRETT/WETH', type: 'BUY', amount: '$45.1K', time: '8s ago' },
    { pair: 'MOCHI/WETH', type: 'BUY', amount: '$3.7K', time: '12s ago' },
    { pair: 'TOSHI/WETH', type: 'SELL', amount: '$21.3K', time: '15s ago' },
  ];

  return (
    <div className="overflow-hidden">
      <div className="flex gap-8 animate-scroll">
        {[...trades, ...trades].map((trade, i) => (
          <div key={i} className="flex items-center gap-3 whitespace-nowrap">
            <span className="text-gray-400 font-mono text-sm">{trade.pair}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              trade.type === 'BUY' ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'
            }`}>
              {trade.type}
            </span>
            <span className="text-white font-mono text-sm">{trade.amount}</span>
            <span className="text-gray-600 text-xs">{trade.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedStat({ value, prefix = '', suffix = '', label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const display = value >= 100 ? Math.floor(count) : count.toFixed(1);

  return (
    <div className="text-center p-6 bg-[#161b22] rounded-xl border border-[#21262d] hover:border-[#3fb950]/30 transition-all hover-lift">
      <div className="text-3xl font-bold text-[#3fb950] glow-green font-mono">
        {prefix}{display}{suffix}
      </div>
      <div className="text-sm text-gray-500 mt-2">{label}</div>
    </div>
  );
}

function PoolTag({ label, chain, change, href }: { label: string; chain: string; change: string; href: string }) {
  const isPositive = change.startsWith('+');
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 px-3 py-2 bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] hover:border-[#3fb950]/50 rounded-lg text-sm transition-all hover-lift group"
    >
      <span className="text-white font-medium group-hover:text-[#3fb950] transition-colors">{label}</span>
      <span className="text-xs text-gray-500">{chain}</span>
      <span className={`text-xs font-mono ${isPositive ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
        {change}
      </span>
    </a>
  );
}

function FeatureCard({ icon, title, desc, stat }: { icon: React.ReactNode; title: string; desc: string; stat: string }) {
  return (
    <div className="p-6 bg-[#161b22] rounded-xl border border-[#21262d] hover:border-[#3fb950]/50 transition-all hover-lift group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 bg-[#3fb950]/5 rounded-full blur-2xl group-hover:bg-[#3fb950]/10 transition-all" />
      <div className="relative">
        <div className="w-12 h-12 rounded-lg bg-[#3fb950]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-semibold">{title}</h3>
          <span className="text-xs px-2 py-1 bg-[#3fb950]/20 text-[#3fb950] rounded font-mono">{stat}</span>
        </div>
        <p className="text-sm text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function ProcessStep({ step, label, active }: { step: number; label: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${active ? 'opacity-100' : 'opacity-50'} hover:opacity-100 transition-opacity`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
        active ? 'bg-[#3fb950] text-black' : 'bg-[#21262d] text-gray-400'
      }`}>
        {step}
      </div>
      <span className="text-xs text-gray-400 text-center max-w-[80px]">{label}</span>
    </div>
  );
}

function ProcessArrow() {
  return (
    <div className="flex items-center text-[#3fb950] animate-pulse">
      <span>→</span>
    </div>
  );
}

// Icons
function OrderBookIcon() {
  return (
    <svg className="w-6 h-6 text-[#3fb950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6 text-[#3fb950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="w-6 h-6 text-[#3fb950]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
