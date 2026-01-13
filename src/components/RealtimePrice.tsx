'use client';

import { useRealtimePrice } from '@/hooks/useRealtimePrice';
import { formatPrice } from '@/lib/api';

interface RealtimePriceProps {
  chainId: string;
  tokenAddress: string;
  initialPrice: number;
  symbol: string;
}

export default function RealtimePrice({
  chainId,
  tokenAddress,
  initialPrice,
  symbol,
}: RealtimePriceProps) {
  const { price, priceChange, isLive } = useRealtimePrice({
    chainId,
    tokenAddress,
    initialPrice,
  });

  const displayPrice = price || initialPrice;
  const changeColor = priceChange >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';
  const changeSign = priceChange >= 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            isLive ? 'bg-[#3fb950] animate-pulse' : 'bg-gray-500'
          }`}
        />
        <span className="text-xs text-gray-400">
          {isLive ? 'LIVE' : 'LOADING'}
        </span>
      </div>

      {/* Price display */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          ${formatPrice(displayPrice)}
        </span>
        {isLive && Math.abs(priceChange) > 0.0001 && (
          <span className={`text-sm font-medium ${changeColor}`}>
            {changeSign}{priceChange.toFixed(4)}%
          </span>
        )}
      </div>

      {/* Token symbol */}
      <span className="text-sm text-gray-400">{symbol}</span>
    </div>
  );
}
