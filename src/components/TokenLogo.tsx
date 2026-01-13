'use client';

import { useState } from 'react';
import Image from 'next/image';

// Well-known token logos (chain-agnostic by symbol)
const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  // Stablecoins
  'USDC': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'DAI': 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  'BUSD': 'https://assets.coingecko.com/coins/images/9576/small/BUSD.png',
  'FRAX': 'https://assets.coingecko.com/coins/images/13422/small/FRAX_icon.png',

  // Major tokens
  'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'ETH': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'BTC': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'BNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'WBNB': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'MATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'WMATIC': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'ARB': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'OP': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'SOL': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',

  // DeFi tokens
  'UNI': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  'AAVE': 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  'LINK': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'CRV': 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  'MKR': 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  'SNX': 'https://assets.coingecko.com/coins/images/3406/small/SNX.png',
  'COMP': 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
  'SUSHI': 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png',

  // Meme tokens
  'DOGE': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  'SHIB': 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  'PEPE': 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  'FLOKI': 'https://assets.coingecko.com/coins/images/16746/small/PNG_image.png',
};

// Chain-specific native token logos
const CHAIN_NATIVE_LOGOS: Record<string, string> = {
  'ethereum': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'base': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'arbitrum': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'optimism': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'polygon': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'bsc': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'solana': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  'avalanche': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
};

interface TokenLogoProps {
  symbol: string;
  imageUrl?: string;
  chainId?: string;
  size?: number;
  className?: string;
}

export default function TokenLogo({
  symbol,
  imageUrl,
  chainId,
  size = 24,
  className = '',
}: TokenLogoProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Determine the logo URL to use
  const getLogoUrl = (): string | null => {
    // 1. Use provided imageUrl if available
    if (imageUrl && !error) return imageUrl;

    // 2. Check known token logos by symbol
    const upperSymbol = symbol.toUpperCase();
    if (KNOWN_TOKEN_LOGOS[upperSymbol]) return KNOWN_TOKEN_LOGOS[upperSymbol];

    // 3. Check for wrapped native tokens
    if (upperSymbol.startsWith('W') && chainId) {
      const nativeLogo = CHAIN_NATIVE_LOGOS[chainId];
      if (nativeLogo) return nativeLogo;
    }

    return null;
  };

  const logoUrl = getLogoUrl();

  // Fallback: show first letter of symbol in a colored circle
  if (!logoUrl || error) {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500',
      'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-orange-500',
    ];
    const colorIndex = symbol.charCodeAt(0) % colors.length;

    return (
      <div
        className={`flex items-center justify-center rounded-full text-white font-bold ${colors[colorIndex]} ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {symbol.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-[#21262d] ${className}`}
      style={{ width: size, height: size }}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-[#30363d]" />
      )}
      <Image
        src={logoUrl}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        className={`rounded-full ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        unoptimized // External URLs need this
      />
    </div>
  );
}

// Paired token logos component (for trading pairs)
interface TokenPairLogosProps {
  baseSymbol: string;
  quoteSymbol: string;
  baseImageUrl?: string;
  quoteImageUrl?: string;
  chainId?: string;
  size?: number;
  className?: string;
}

export function TokenPairLogos({
  baseSymbol,
  quoteSymbol,
  baseImageUrl,
  quoteImageUrl,
  chainId,
  size = 24,
  className = '',
}: TokenPairLogosProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <TokenLogo
        symbol={baseSymbol}
        imageUrl={baseImageUrl}
        chainId={chainId}
        size={size}
        className="z-10"
      />
      <TokenLogo
        symbol={quoteSymbol}
        imageUrl={quoteImageUrl}
        chainId={chainId}
        size={size}
        className="-ml-2 z-0"
      />
    </div>
  );
}
