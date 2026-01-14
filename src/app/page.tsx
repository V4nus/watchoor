'use client';

import SearchBox from '@/components/SearchBox';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, TrendingUp, Droplets, BarChart3, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

// Chain logos - use local files
const CHAIN_LOGOS: Record<string, string> = {
  base: '/chains/base.svg',
  bsc: '/chains/bsc.svg',
  solana: '/chains/solana.png',
  ethereum: '/chains/ethereum.png',
};

const CHAINS = [
  { id: 'base', label: 'Base', logo: CHAIN_LOGOS.base },
  { id: 'bsc', label: 'BSC', logo: CHAIN_LOGOS.bsc },
  { id: 'solana', label: 'SOL', logo: CHAIN_LOGOS.solana },
  { id: 'ethereum', label: 'ETH', logo: CHAIN_LOGOS.ethereum },
];

// Local token icons mapping (downloaded to /public/tokens/)
// For tokens without local icons, we use CoinGecko API as fallback
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  // Base tokens
  DEGEN: '/tokens/degen.png',
  BRETT: '/tokens/brett.png',
  AERO: '/tokens/aero.png',
  cbBTC: '/tokens/cbbtc.webp',
  // BSC tokens
  BAKE: '/tokens/bake.jpg',
  XVS: '/tokens/xvs.png',
  BSW: '/tokens/bsw.png',
  TWT: '/tokens/twt.png',
  SFP: '/tokens/sfp.png',
  // Solana tokens
  WIF: '/tokens/wif.jpg',
  BONK: '/tokens/bonk.jpg',
  PYTH: '/tokens/pyth.png',
  JUP: '/tokens/jup.png',
  // Ethereum tokens
  PEPE: '/tokens/pepe.jpg',
  FLOKI: '/tokens/floki.png',
  SHIB: '/tokens/shib.png',
};

// CoinGecko icon fallbacks for tokens without local icons
const COINGECKO_ICONS: Record<string, string> = {
  // Base tokens
  TOSHI: 'https://assets.coingecko.com/coins/images/31126/small/Toshi_Logo.png',
  VIRTUAL: 'https://assets.coingecko.com/coins/images/36285/small/virtual.png',
  WELL: 'https://assets.coingecko.com/coins/images/26133/small/moonwell.png',
  EXTRA: 'https://assets.coingecko.com/coins/images/31045/small/extra.png',
  BALD: 'https://assets.coingecko.com/coins/images/31119/small/bald.png',
  BASED: 'https://assets.coingecko.com/coins/images/31108/small/based.png',
  // BSC tokens
  CAKE: 'https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png',
  ALPACA: 'https://assets.coingecko.com/coins/images/14165/small/alpaca_logo.png',
  RACA: 'https://assets.coingecko.com/coins/images/17841/small/raca.png',
  BABY: 'https://assets.coingecko.com/coins/images/16169/small/baby.png',
  LINA: 'https://assets.coingecko.com/coins/images/12509/small/linear.png',
  // Solana tokens
  JTO: 'https://assets.coingecko.com/coins/images/33103/small/jto.png',
  ORCA: 'https://assets.coingecko.com/coins/images/17547/small/orca.png',
  RAY: 'https://assets.coingecko.com/coins/images/13928/small/ray.png',
  POPCAT: 'https://assets.coingecko.com/coins/images/35642/small/popcat.jpg',
  RENDER: 'https://assets.coingecko.com/coins/images/11636/small/render.png',
  KMNO: 'https://assets.coingecko.com/coins/images/36081/small/kamino.png',
  // Ethereum tokens
  MOG: 'https://assets.coingecko.com/coins/images/31200/small/mog.png',
  TURBO: 'https://assets.coingecko.com/coins/images/30117/small/turbo.png',
  APE: 'https://assets.coingecko.com/coins/images/24383/small/apecoin.png',
  LDO: 'https://assets.coingecko.com/coins/images/13573/small/lido.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uni.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave.png',
  ENS: 'https://assets.coingecko.com/coins/images/19785/small/ens.png',
};

const getTokenLogo = (symbol: string): string => {
  // First check local icons
  if (LOCAL_TOKEN_ICONS[symbol]) {
    return LOCAL_TOKEN_ICONS[symbol];
  }
  // Then check CoinGecko fallbacks
  if (COINGECKO_ICONS[symbol]) {
    return COINGECKO_ICONS[symbol];
  }
  return '';
};

// Demo trending pools data - using local icons where available
const ALL_POOLS = [
  // Base pools (10)
  {
    rank: 1, symbol: 'DEGEN', name: 'Degen', pair: 'DEGEN/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0xc9034c3e7f58003e6ae0c8438e7c8f4598d5acaa',
    logo: getTokenLogo('DEGEN'),
    price: 0.0089, change24h: -5.2, volume24h: 12300000, liquidity: 8900000, mcap: 890000000, liquidityRatio: 1.0,
  },
  {
    rank: 2, symbol: 'BRETT', name: 'Brett', pair: 'BRETT/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x76bf0abd20f1e0155ce40a62615a90a709a6c3d8',
    logo: getTokenLogo('BRETT'),
    price: 0.156, change24h: 8.7, volume24h: 9800000, liquidity: 15200000, mcap: 1500000000, liquidityRatio: 1.01,
  },
  {
    rank: 3, symbol: 'TOSHI', name: 'Toshi', pair: 'TOSHI/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('TOSHI'),
    price: 0.00032, change24h: 15.3, volume24h: 4500000, liquidity: 3200000, mcap: 320000000, liquidityRatio: 1.0,
  },
  {
    rank: 4, symbol: 'AERO', name: 'Aerodrome', pair: 'AERO/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('AERO'),
    price: 1.25, change24h: 3.2, volume24h: 18000000, liquidity: 45000000, mcap: 750000000, liquidityRatio: 6.0,
  },
  {
    rank: 5, symbol: 'VIRTUAL', name: 'Virtual Protocol', pair: 'VIRTUAL/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('VIRTUAL'),
    price: 2.85, change24h: 12.4, volume24h: 25000000, liquidity: 18000000, mcap: 2800000000, liquidityRatio: 0.64,
  },
  {
    rank: 6, symbol: 'WELL', name: 'Moonwell', pair: 'WELL/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('WELL'),
    price: 0.045, change24h: -2.8, volume24h: 3200000, liquidity: 8500000, mcap: 180000000, liquidityRatio: 4.7,
  },
  {
    rank: 7, symbol: 'EXTRA', name: 'Extra Finance', pair: 'EXTRA/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('EXTRA'),
    price: 0.12, change24h: 5.6, volume24h: 1800000, liquidity: 4200000, mcap: 45000000, liquidityRatio: 9.3,
  },
  {
    rank: 8, symbol: 'BALD', name: 'Bald', pair: 'BALD/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('BALD'),
    price: 0.0023, change24h: -12.5, volume24h: 850000, liquidity: 1200000, mcap: 23000000, liquidityRatio: 5.2,
  },
  {
    rank: 9, symbol: 'BASED', name: 'Based', pair: 'BASED/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('BASED'),
    price: 0.00089, change24h: 3.4, volume24h: 620000, liquidity: 980000, mcap: 8900000, liquidityRatio: 11.0,
  },
  {
    rank: 10, symbol: 'cbBTC', name: 'Coinbase BTC', pair: 'cbBTC/WETH', chain: 'base', chainLabel: 'Base',
    poolAddress: '0x0', logo: getTokenLogo('cbBTC'),
    price: 42500, change24h: 1.2, volume24h: 35000000, liquidity: 85000000, mcap: 4200000000, liquidityRatio: 2.0,
  },
  // BSC pools (10)
  {
    rank: 1, symbol: 'CAKE', name: 'PancakeSwap', pair: 'CAKE/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('CAKE'),
    price: 2.45, change24h: 2.1, volume24h: 45000000, liquidity: 120000000, mcap: 680000000, liquidityRatio: 17.6,
  },
  {
    rank: 2, symbol: 'BAKE', name: 'BakerySwap', pair: 'BAKE/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('BAKE'),
    price: 0.18, change24h: -3.5, volume24h: 2300000, liquidity: 4500000, mcap: 45000000, liquidityRatio: 10.0,
  },
  {
    rank: 3, symbol: 'XVS', name: 'Venus', pair: 'XVS/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('XVS'),
    price: 8.90, change24h: 5.8, volume24h: 8900000, liquidity: 25000000, mcap: 130000000, liquidityRatio: 19.2,
  },
  {
    rank: 4, symbol: 'ALPACA', name: 'Alpaca Finance', pair: 'ALPACA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('ALPACA'),
    price: 0.15, change24h: -1.2, volume24h: 1200000, liquidity: 3800000, mcap: 28000000, liquidityRatio: 13.6,
  },
  {
    rank: 5, symbol: 'RACA', name: 'Radio Caca', pair: 'RACA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('RACA'),
    price: 0.00012, change24h: 8.5, volume24h: 5600000, liquidity: 8200000, mcap: 52000000, liquidityRatio: 15.8,
  },
  {
    rank: 6, symbol: 'BSW', name: 'Biswap', pair: 'BSW/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('BSW'),
    price: 0.065, change24h: -4.2, volume24h: 3400000, liquidity: 9800000, mcap: 42000000, liquidityRatio: 23.3,
  },
  {
    rank: 7, symbol: 'BABY', name: 'BabySwap', pair: 'BABY/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('BABY'),
    price: 0.00045, change24h: 2.8, volume24h: 890000, liquidity: 2100000, mcap: 9500000, liquidityRatio: 22.1,
  },
  {
    rank: 8, symbol: 'TWT', name: 'Trust Wallet', pair: 'TWT/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('TWT'),
    price: 1.15, change24h: 1.5, volume24h: 12000000, liquidity: 35000000, mcap: 480000000, liquidityRatio: 7.3,
  },
  {
    rank: 9, symbol: 'SFP', name: 'SafePal', pair: 'SFP/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('SFP'),
    price: 0.72, change24h: -0.8, volume24h: 4500000, liquidity: 15000000, mcap: 360000000, liquidityRatio: 4.2,
  },
  {
    rank: 10, symbol: 'LINA', name: 'Linear', pair: 'LINA/BNB', chain: 'bsc', chainLabel: 'BSC',
    poolAddress: '0x0', logo: getTokenLogo('LINA'),
    price: 0.0085, change24h: 6.2, volume24h: 2800000, liquidity: 6500000, mcap: 48000000, liquidityRatio: 13.5,
  },
  // Solana pools (10)
  {
    rank: 1, symbol: 'WIF', name: 'dogwifhat', pair: 'WIF/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('WIF'),
    price: 2.34, change24h: -2.1, volume24h: 32000000, liquidity: 18000000, mcap: 2300000000, liquidityRatio: 0.78,
  },
  {
    rank: 2, symbol: 'BONK', name: 'Bonk', pair: 'BONK/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('BONK'),
    price: 0.0000234, change24h: 4.2, volume24h: 28000000, liquidity: 12000000, mcap: 1800000000, liquidityRatio: 0.67,
  },
  {
    rank: 3, symbol: 'JTO', name: 'Jito', pair: 'JTO/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('JTO'),
    price: 3.45, change24h: 8.9, volume24h: 45000000, liquidity: 35000000, mcap: 420000000, liquidityRatio: 8.3,
  },
  {
    rank: 4, symbol: 'PYTH', name: 'Pyth Network', pair: 'PYTH/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('PYTH'),
    price: 0.38, change24h: 1.5, volume24h: 22000000, liquidity: 28000000, mcap: 1400000000, liquidityRatio: 2.0,
  },
  {
    rank: 5, symbol: 'JUP', name: 'Jupiter', pair: 'JUP/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('JUP'),
    price: 0.92, change24h: 3.8, volume24h: 85000000, liquidity: 65000000, mcap: 1250000000, liquidityRatio: 5.2,
  },
  {
    rank: 6, symbol: 'ORCA', name: 'Orca', pair: 'ORCA/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('ORCA'),
    price: 4.25, change24h: 5.2, volume24h: 12000000, liquidity: 22000000, mcap: 280000000, liquidityRatio: 7.9,
  },
  {
    rank: 7, symbol: 'RAY', name: 'Raydium', pair: 'RAY/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('RAY'),
    price: 5.80, change24h: -1.8, volume24h: 35000000, liquidity: 48000000, mcap: 850000000, liquidityRatio: 5.6,
  },
  {
    rank: 8, symbol: 'POPCAT', name: 'Popcat', pair: 'POPCAT/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('POPCAT'),
    price: 0.85, change24h: 18.5, volume24h: 42000000, liquidity: 15000000, mcap: 830000000, liquidityRatio: 1.8,
  },
  {
    rank: 9, symbol: 'RENDER', name: 'Render', pair: 'RENDER/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('RENDER'),
    price: 7.25, change24h: 2.4, volume24h: 28000000, liquidity: 42000000, mcap: 2800000000, liquidityRatio: 1.5,
  },
  {
    rank: 10, symbol: 'KMNO', name: 'Kamino', pair: 'KMNO/SOL', chain: 'solana', chainLabel: 'SOL',
    poolAddress: '0x0', logo: getTokenLogo('KMNO'),
    price: 0.12, change24h: -3.5, volume24h: 8500000, liquidity: 18000000, mcap: 120000000, liquidityRatio: 15.0,
  },
  // Ethereum pools (10)
  {
    rank: 1, symbol: 'PEPE', name: 'Pepe', pair: 'PEPE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0xa43fe16908251ee70ef74718545e4fe6c5ccec9f',
    logo: getTokenLogo('PEPE'),
    price: 0.00001234, change24h: 12.5, volume24h: 45600000, liquidity: 28500000, mcap: 5200000000, liquidityRatio: 0.55,
  },
  {
    rank: 2, symbol: 'MOG', name: 'Mog Coin', pair: 'MOG/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('MOG'),
    price: 0.0000021, change24h: 25.3, volume24h: 8200000, liquidity: 4500000, mcap: 850000000, liquidityRatio: 0.53,
  },
  {
    rank: 3, symbol: 'TURBO', name: 'Turbo', pair: 'TURBO/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('TURBO'),
    price: 0.0067, change24h: -8.4, volume24h: 5600000, liquidity: 3200000, mcap: 420000000, liquidityRatio: 0.76,
  },
  {
    rank: 4, symbol: 'FLOKI', name: 'Floki', pair: 'FLOKI/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('FLOKI'),
    price: 0.00017, change24h: 6.8, volume24h: 18000000, liquidity: 9500000, mcap: 1600000000, liquidityRatio: 0.59,
  },
  {
    rank: 5, symbol: 'SHIB', name: 'Shiba Inu', pair: 'SHIB/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('SHIB'),
    price: 0.0000245, change24h: 3.2, volume24h: 125000000, liquidity: 85000000, mcap: 14500000000, liquidityRatio: 0.59,
  },
  {
    rank: 6, symbol: 'APE', name: 'ApeCoin', pair: 'APE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('APE'),
    price: 1.45, change24h: -2.1, volume24h: 42000000, liquidity: 35000000, mcap: 870000000, liquidityRatio: 4.0,
  },
  {
    rank: 7, symbol: 'LDO', name: 'Lido DAO', pair: 'LDO/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('LDO'),
    price: 2.15, change24h: 1.8, volume24h: 65000000, liquidity: 120000000, mcap: 1920000000, liquidityRatio: 6.25,
  },
  {
    rank: 8, symbol: 'UNI', name: 'Uniswap', pair: 'UNI/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('UNI'),
    price: 12.50, change24h: 4.5, volume24h: 180000000, liquidity: 250000000, mcap: 7500000000, liquidityRatio: 3.33,
  },
  {
    rank: 9, symbol: 'AAVE', name: 'Aave', pair: 'AAVE/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('AAVE'),
    price: 285, change24h: 2.8, volume24h: 95000000, liquidity: 180000000, mcap: 4200000000, liquidityRatio: 4.29,
  },
  {
    rank: 10, symbol: 'ENS', name: 'ENS', pair: 'ENS/WETH', chain: 'ethereum', chainLabel: 'ETH',
    poolAddress: '0x0', logo: getTokenLogo('ENS'),
    price: 28.50, change24h: -1.2, volume24h: 32000000, liquidity: 65000000, mcap: 850000000, liquidityRatio: 7.65,
  },
];

const STATS = {
  totalLiquidity: 2400000000,
  poolsTracked: 12500,
  chains: 6,
  volume24h: 890000000,
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [selectedChain, setSelectedChain] = useState('base');
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-[#0b0b0e]" />;
  }

  const filteredPools = ALL_POOLS.filter(pool => pool.chain === selectedChain);

  return (
    <div className="min-h-screen bg-[#0b0b0e] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="0xArgus" className="h-8" />
          </Link>
          <nav className="flex items-center gap-4">
            <a
              href="https://github.com/V4nus/0xArgus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm hidden sm:block"
            >
              GitHub
            </a>
            <a
              href="https://x.com/0xArgus_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-white transition-colors text-sm hidden sm:block"
            >
              Twitter
            </a>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Hero - Compact */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t.home.depthScanner}
          </h1>
          <p className="text-gray-500 mb-6">
            {t.home.heroSubtitle}
          </p>
          <div className="max-w-2xl">
            <SearchBox />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Droplets size={18} />}
            label={t.home.totalLiquidity}
            value={`$${formatNumber(STATS.totalLiquidity)}`}
          />
          <StatCard
            icon={<BarChart3 size={18} />}
            label={t.home.volume24h}
            value={`$${formatNumber(STATS.volume24h)}`}
          />
          <StatCard
            icon={<TrendingUp size={18} />}
            label={t.home.poolsTracked}
            value={formatNumber(STATS.poolsTracked)}
          />
          <StatCard
            icon={<RefreshCw size={18} />}
            label={t.home.chains}
            value={STATS.chains.toString()}
          />
        </div>

        {/* Trending Pools Table */}
        <div className="bg-[#111114] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold">{t.home.trendingPools}</h2>

            {/* Chain Selector */}
            <div className="flex items-center gap-2">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedChain === chain.id
                      ? 'bg-white/10 text-white'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <img
                    src={chain.logo}
                    alt={chain.label}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="hidden sm:inline">{chain.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 text-xs text-gray-500 border-b border-white/5">
            <div className="col-span-1">#</div>
            <div className="col-span-3">Pool</div>
            <div className="col-span-2 text-right">{t.common.price}</div>
            <div className="col-span-1 text-right">24h</div>
            <div className="col-span-2 text-right">{t.home.volume24h}</div>
            <div className="col-span-2 text-right">{t.common.liquidity}</div>
            <div className="col-span-1 text-right">{t.home.depth}</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {filteredPools.map((pool, index) => (
              <PoolRow key={`${pool.chain}-${pool.symbol}`} pool={{...pool, rank: index + 1}} t={t} />
            ))}
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>{t.home.exploreRealPools}</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-gray-600 text-sm">
          0xArgus - DeFi Liquidity Analytics
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#111114] rounded-lg border border-white/5 p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function PoolRow({ pool, t }: { pool: typeof ALL_POOLS[0]; t: ReturnType<typeof useTranslations> }) {
  const [imgError, setImgError] = useState(false);
  const isPositive = pool.change24h >= 0;
  const depthColor = pool.liquidityRatio >= 1 ? '#22c55e' : pool.liquidityRatio >= 0.7 ? '#eab308' : '#ef4444';
  const depthLabel = pool.liquidityRatio >= 1 ? t.home.deep : pool.liquidityRatio >= 0.7 ? t.home.medium : t.home.shallow;

  const href = pool.poolAddress !== '0x0'
    ? `/pool/${pool.chain}/${pool.poolAddress}`
    : undefined;

  const content = (
    <>
      {/* Rank */}
      <div className="col-span-2 sm:col-span-1 text-gray-500 font-mono text-sm">
        {pool.rank}
      </div>

      {/* Pool Info */}
      <div className="col-span-10 sm:col-span-3 flex items-center gap-3">
        {!imgError && pool.logo ? (
          <img
            src={pool.logo}
            alt={pool.symbol}
            className="w-8 h-8 rounded-full"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
            {pool.symbol[0]}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{pool.symbol}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
              {pool.chainLabel}
            </span>
          </div>
          <div className="text-xs text-gray-500 truncate">{pool.pair}</div>
        </div>
      </div>

      {/* Mobile: Show key stats in 2 columns */}
      <div className="col-span-6 sm:hidden text-xs text-gray-500 mt-2">
        <div className="flex justify-between">
          <span>{t.common.price}:</span>
          <span className="text-white font-mono">${formatPrice(pool.price)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>{t.common.liquidity}:</span>
          <span className="text-white">${formatNumber(pool.liquidity)}</span>
        </div>
      </div>
      <div className="col-span-6 sm:hidden text-xs mt-2">
        <div className="flex justify-between">
          <span className="text-gray-500">24h:</span>
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            {isPositive ? '+' : ''}{pool.change24h.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-gray-500">{t.home.depth}:</span>
          <span style={{ color: depthColor }}>{depthLabel}</span>
        </div>
      </div>

      {/* Desktop columns */}
      <div className="hidden sm:block sm:col-span-2 text-right font-mono text-sm">
        ${formatPrice(pool.price)}
      </div>

      <div className={`hidden sm:flex sm:col-span-1 justify-end items-center gap-1 text-sm ${
        isPositive ? 'text-green-500' : 'text-red-500'
      }`}>
        {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        {Math.abs(pool.change24h).toFixed(1)}%
      </div>

      <div className="hidden sm:block sm:col-span-2 text-right text-sm text-gray-300">
        ${formatNumber(pool.volume24h)}
      </div>

      <div className="hidden sm:block sm:col-span-2 text-right text-sm text-gray-300">
        ${formatNumber(pool.liquidity)}
      </div>

      <div className="hidden sm:flex sm:col-span-1 justify-end">
        <span
          className="text-xs px-2 py-1 rounded-full"
          style={{
            backgroundColor: `${depthColor}15`,
            color: depthColor
          }}
        >
          {depthLabel}
        </span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors items-center cursor-pointer"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors items-center opacity-60">
      {content}
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toFixed(0);
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.0001) return price.toFixed(6);
  if (price >= 0.0000001) return price.toFixed(8);
  return price.toExponential(2);
}
