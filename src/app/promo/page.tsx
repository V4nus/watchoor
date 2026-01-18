'use client';

import { useEffect, useRef, useState } from 'react';

// Animation scenes
type Scene = 'intro' | 'problem' | 'solution' | 'demo' | 'features' | 'cta';

// Scene timing (in ms) - moved outside component to avoid re-creation
const SCENE_DURATIONS: Record<Scene, number> = {
  intro: 3000,
  problem: 4000,
  solution: 4000,
  demo: 5000,
  features: 4000,
  cta: 3000,
};

const SCENES: Scene[] = ['intro', 'problem', 'solution', 'demo', 'features', 'cta'];

export default function PromoPage() {
  const [currentScene, setCurrentScene] = useState<Scene>('intro');
  const [isPlaying, setIsPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-advance scenes
  useEffect(() => {
    if (!isPlaying) return;

    const currentIndex = SCENES.indexOf(currentScene);
    const nextScene = currentIndex < SCENES.length - 1 ? SCENES[currentIndex + 1] : SCENES[0];

    const timer = setTimeout(() => {
      setCurrentScene(nextScene);
    }, SCENE_DURATIONS[currentScene]);

    return () => clearTimeout(timer);
  }, [currentScene, isPlaying]);

  // Matrix rain effect for background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01アイウエオカキクケコ$¥€₿ΞWATCHOOR';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#22c55e20';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* Matrix background */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-30" />

      {/* Main content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {currentScene === 'intro' && <IntroScene />}
        {currentScene === 'problem' && <ProblemScene />}
        {currentScene === 'solution' && <SolutionScene />}
        {currentScene === 'demo' && <DemoScene />}
        {currentScene === 'features' && <FeaturesScene />}
        {currentScene === 'cta' && <CTAScene />}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900">
        <div
          className="h-full bg-[#22c55e] transition-all duration-300"
          style={{
            width: `${((SCENES.indexOf(currentScene) + 1) / SCENES.length) * 100}%`,
          }}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="px-4 py-2 bg-[#22c55e]/20 border border-[#22c55e]/30 rounded-lg text-[#22c55e] text-sm hover:bg-[#22c55e]/30 transition-colors"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <div className="flex gap-2">
          {SCENES.map((scene, i) => (
            <button
              key={scene}
              onClick={() => setCurrentScene(scene)}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentScene === scene ? 'bg-[#22c55e]' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scene indicator */}
      <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
        {SCENES.indexOf(currentScene) + 1}/{SCENES.length}
      </div>
    </div>
  );
}

// Scene 1: Intro - Logo animation
function IntroScene() {
  const [eyeOpen, setEyeOpen] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    setTimeout(() => setEyeOpen(true), 500);
    setTimeout(() => setShowText(true), 1500);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Animated eye logo */}
      <div className="relative">
        <svg
          width="200"
          height="200"
          viewBox="0 0 48 48"
          className="drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]"
        >
          {/* Outer eye */}
          <path
            d="M24 12C14 12 6 24 6 24C6 24 14 36 24 36C34 36 42 24 42 24C42 24 34 12 24 12Z"
            stroke="#22c55e"
            strokeWidth="2"
            fill="none"
            className={`transition-all duration-1000 ${
              eyeOpen ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: eyeOpen ? 0 : 100,
              transition: 'stroke-dashoffset 1s ease-out',
            }}
          />
          {/* Iris */}
          <circle
            cx="24"
            cy="24"
            r="8"
            stroke="#22c55e"
            strokeWidth="1.5"
            fill="none"
            className={`transition-all duration-700 delay-300 ${
              eyeOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`}
            style={{ transformOrigin: 'center' }}
          />
          {/* Pupil */}
          <circle
            cx="24"
            cy="24"
            r="4"
            fill="#22c55e"
            className={`transition-all duration-500 delay-500 ${
              eyeOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`}
            style={{ transformOrigin: 'center' }}
          />
          {/* Scanning line */}
          {eyeOpen && (
            <line
              x1="6"
              y1="24"
              x2="42"
              y2="24"
              stroke="#22c55e"
              strokeWidth="1"
              className="animate-pulse opacity-50"
            />
          )}
        </svg>

        {/* Glow effect */}
        <div className={`absolute inset-0 bg-[#22c55e]/20 rounded-full blur-3xl transition-opacity duration-1000 ${eyeOpen ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      {/* Brand name */}
      <div
        className={`transition-all duration-1000 ${
          showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <h1 className="text-4xl sm:text-6xl font-bold tracking-wider text-white">
          Watch<span className="text-[#22c55e]">oor</span>
        </h1>
        <p className="text-center text-gray-500 mt-2 font-mono text-xs sm:text-sm">
          The All-Seeing Eye of DeFi
        </p>
      </div>
    </div>
  );
}

// Scene 2: Problem - What's hidden in AMM?
function ProblemScene() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1500),
      setTimeout(() => setStep(3), 2500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8">
      <h2
        className={`text-2xl sm:text-4xl font-bold text-center mb-6 sm:mb-12 transition-all duration-700 ${
          step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        AMM pools hide the <span className="text-red-500">real</span> liquidity
      </h2>

      <div className="grid grid-cols-3 gap-2 sm:gap-8">
        {/* Traditional metrics */}
        <div
          className={`bg-gray-900/50 border border-gray-800 rounded-xl p-3 sm:p-6 transition-all duration-700 ${
            step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-red-500 text-2xl sm:text-5xl font-bold font-mono">$10M</div>
          <div className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-base">TVL shown</div>
          <div className="text-gray-600 text-xs sm:text-sm mt-2 sm:mt-4 hidden sm:block">
            Looks liquid...
          </div>
        </div>

        <div
          className={`flex items-center justify-center transition-all duration-700 delay-100 ${
            step >= 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="text-2xl sm:text-4xl text-gray-600">≠</div>
        </div>

        <div
          className={`bg-gray-900/50 border border-gray-800 rounded-xl p-3 sm:p-6 transition-all duration-700 delay-200 ${
            step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="text-[#22c55e] text-2xl sm:text-5xl font-bold font-mono">$50K</div>
          <div className="text-gray-500 mt-1 sm:mt-2 text-xs sm:text-base">Actual depth</div>
          <div className="text-gray-600 text-xs sm:text-sm mt-2 sm:mt-4 hidden sm:block">
            Reality: 0.5% of TVL
          </div>
        </div>
      </div>

      <p
        className={`text-center text-base sm:text-xl text-gray-400 mt-6 sm:mt-12 transition-all duration-700 ${
          step >= 3 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        You need to see the <span className="text-[#22c55e]">order book</span>, not just the pool.
      </p>
    </div>
  );
}

// Scene 3: Solution - Watchoor transforms data
function SolutionScene() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 300),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
        {/* AMM Pool */}
        <div
          className={`text-center transition-all duration-700 ${
            step >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
          }`}
        >
          <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-2xl sm:text-4xl">🌊</span>
          </div>
          <p className="mt-2 sm:mt-4 text-gray-400 text-sm sm:text-base">AMM</p>
        </div>

        {/* Arrow with Watchoor */}
        <div
          className={`flex flex-col items-center transition-all duration-700 delay-300 ${
            step >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`}
        >
          <svg width="80" height="30" viewBox="0 0 120 40" className="sm:w-[120px] sm:h-[40px] rotate-90 sm:rotate-0">
            <defs>
              <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path
              d="M0 20 L100 20 M85 10 L100 20 L85 30"
              stroke="url(#arrowGrad)"
              strokeWidth="3"
              fill="none"
              className="animate-pulse"
            />
          </svg>
          <div className="mt-2 px-3 sm:px-4 py-1 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-full">
            <span className="text-[#22c55e] text-xs sm:text-sm font-mono">Watchoor</span>
          </div>
        </div>

        {/* Order Book */}
        <div
          className={`text-center transition-all duration-700 delay-500 ${
            step >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
          }`}
        >
          <div className="w-32 h-24 sm:w-40 sm:h-32 bg-gray-900/80 border border-[#22c55e]/30 rounded-lg p-2 font-mono text-[10px] sm:text-xs">
            <div className="text-gray-500 text-center mb-1">Order Book</div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-red-400">
                <span>39.12</span>
                <span>1,245</span>
              </div>
              <div className="flex justify-between text-red-400/70">
                <span>38.98</span>
                <span>823</span>
              </div>
              <div className="h-px bg-gray-700 my-0.5" />
              <div className="flex justify-between text-[#22c55e]/70">
                <span>38.42</span>
                <span>1,520</span>
              </div>
              <div className="flex justify-between text-[#22c55e]">
                <span>38.28</span>
                <span>2,890</span>
              </div>
            </div>
          </div>
          <p className="mt-2 sm:mt-4 text-gray-400 text-sm sm:text-base">Order Book</p>
        </div>
      </div>

      <p
        className={`text-center text-lg sm:text-2xl mt-6 sm:mt-12 transition-all duration-700 ${
          step >= 3 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="text-white">Decode AMM into</span>{' '}
        <span className="text-[#22c55e]">tradeable intelligence</span>
      </p>
    </div>
  );
}

// Scene 4: Demo - Animated order book
function DemoScene() {
  const [bids, setBids] = useState<{ price: number; size: number }[]>([]);
  const [asks, setAsks] = useState<{ price: number; size: number }[]>([]);

  useEffect(() => {
    // Generate initial data
    const generateData = () => {
      const basePrice = 38.5;
      const newBids = Array(6)
        .fill(0)
        .map((_, i) => ({
          price: basePrice - (i + 1) * 0.15 + Math.random() * 0.05,
          size: Math.floor(500 + Math.random() * 2500),
        }));
      const newAsks = Array(6)
        .fill(0)
        .map((_, i) => ({
          price: basePrice + (i + 1) * 0.15 + Math.random() * 0.05,
          size: Math.floor(300 + Math.random() * 1500),
        }));
      setBids(newBids);
      setAsks(newAsks);
    };

    generateData();
    const interval = setInterval(generateData, 800);
    return () => clearInterval(interval);
  }, []);

  const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8">
      <div className="text-center mb-4 sm:mb-8">
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-900/50 border border-gray-800 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-gray-400 font-mono text-xs sm:text-sm">TRUMP/SOL · Solana</span>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-6">
        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          {/* Bids */}
          <div>
            <div className="text-[#22c55e] text-xs sm:text-sm font-mono mb-2 sm:mb-4">BIDS</div>
            <div className="space-y-1 sm:space-y-2">
              {bids.map((bid, i) => (
                <div key={i} className="relative">
                  <div
                    className="absolute inset-y-0 right-0 bg-[#22c55e]/20 rounded transition-all duration-300"
                    style={{ width: `${(bid.size / maxSize) * 100}%` }}
                  />
                  <div className="relative flex justify-between px-2 sm:px-3 py-1 sm:py-1.5 font-mono text-xs sm:text-sm">
                    <span className="text-[#22c55e]">{bid.price.toFixed(2)}</span>
                    <span className="text-gray-400">{bid.size.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asks */}
          <div>
            <div className="text-red-500 text-xs sm:text-sm font-mono mb-2 sm:mb-4">ASKS</div>
            <div className="space-y-1 sm:space-y-2">
              {asks.map((ask, i) => (
                <div key={i} className="relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-500/20 rounded transition-all duration-300"
                    style={{ width: `${(ask.size / maxSize) * 100}%` }}
                  />
                  <div className="relative flex justify-between px-2 sm:px-3 py-1 sm:py-1.5 font-mono text-xs sm:text-sm">
                    <span className="text-gray-400">{ask.size.toLocaleString()}</span>
                    <span className="text-red-500">{ask.price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-800 grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div>
            <div className="text-[#22c55e] text-sm sm:text-xl font-mono font-bold">$74,997</div>
            <div className="text-gray-500 text-[10px] sm:text-xs">Bid Liquidity</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm sm:text-xl font-mono font-bold">0.025%</div>
            <div className="text-gray-500 text-[10px] sm:text-xs">Spread</div>
          </div>
          <div>
            <div className="text-red-500 text-sm sm:text-xl font-mono font-bold">$45,318</div>
            <div className="text-gray-500 text-[10px] sm:text-xs">Ask Liquidity</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Scene 5: Features
function FeaturesScene() {
  const [visibleFeatures, setVisibleFeatures] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setVisibleFeatures(1), 300),
      setTimeout(() => setVisibleFeatures(2), 800),
      setTimeout(() => setVisibleFeatures(3), 1300),
      setTimeout(() => setVisibleFeatures(4), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const features = [
    { icon: '🔍', title: 'Multi-Chain', desc: 'Base · Ethereum · Solana' },
    { icon: '⚡', title: 'Real-Time', desc: 'WebSocket streaming' },
    { icon: '🎯', title: 'V2/V3/V4', desc: 'All AMM types supported' },
    { icon: '🔌', title: 'x402 API', desc: 'Pay-per-request access' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8">
      <h2 className="text-xl sm:text-3xl font-bold text-center mb-6 sm:mb-12">
        Built for <span className="text-[#22c55e]">AI Agents</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
        {features.map((feature, i) => (
          <div
            key={i}
            className={`bg-gray-900/50 border border-gray-800 rounded-xl p-4 sm:p-6 text-center transition-all duration-500 ${
              visibleFeatures > i
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="text-2xl sm:text-4xl mb-2 sm:mb-4">{feature.icon}</div>
            <div className="text-white font-medium text-sm sm:text-base">{feature.title}</div>
            <div className="text-gray-500 text-xs sm:text-sm mt-1">{feature.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Scene 6: CTA
function CTAScene() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setTimeout(() => setShow(true), 300);
  }, []);

  return (
    <div
      className={`text-center px-4 transition-all duration-1000 ${
        show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
      }`}
    >
      {/* Logo */}
      <svg
        width="60"
        height="60"
        viewBox="0 0 48 48"
        className="mx-auto mb-4 sm:mb-6 sm:w-[80px] sm:h-[80px] drop-shadow-[0_0_20px_rgba(34,197,94,0.5)]"
      >
        <path
          d="M24 12C14 12 6 24 6 24C6 24 14 36 24 36C34 36 42 24 42 24C42 24 34 12 24 12Z"
          stroke="#22c55e"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="24" cy="24" r="8" stroke="#22c55e" strokeWidth="1.5" fill="none" />
        <circle cx="24" cy="24" r="4" fill="#22c55e" />
      </svg>

      <h2 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4">
        See what others <span className="text-[#22c55e]">can&apos;t</span>
      </h2>

      <p className="text-base sm:text-xl text-gray-400 mb-6 sm:mb-8">
        watchoor.vercel.app
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <div className="px-5 sm:px-6 py-2.5 sm:py-3 bg-[#22c55e] text-black font-bold rounded-full text-sm sm:text-base">
          Try Now - Free
        </div>
        <div className="px-5 sm:px-6 py-2.5 sm:py-3 border border-[#22c55e]/30 text-[#22c55e] rounded-full font-mono text-xs sm:text-sm">
          API: $0.01/req
        </div>
      </div>

      <div className="mt-6 sm:mt-8 text-gray-600 text-xs sm:text-sm">
        @watchoor · Powered by x402
      </div>
    </div>
  );
}
