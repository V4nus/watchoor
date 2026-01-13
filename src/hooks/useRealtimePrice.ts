'use client';

import { useEffect, useState, useCallback } from 'react';
import { getRealtimeService, PriceUpdate } from '@/lib/realtime';

interface UseRealtimePriceOptions {
  chainId: string;
  tokenAddress: string;
  initialPrice?: number;
}

interface RealtimePriceState {
  price: number;
  priceChange: number;
  lastUpdate: number;
  isLive: boolean;
}

export function useRealtimePrice({
  chainId,
  tokenAddress,
  initialPrice = 0,
}: UseRealtimePriceOptions): RealtimePriceState {
  const [state, setState] = useState<RealtimePriceState>({
    price: initialPrice,
    priceChange: 0,
    lastUpdate: Date.now(),
    isLive: false,
  });

  const handleUpdate = useCallback((update: PriceUpdate) => {
    setState({
      price: update.price,
      priceChange: update.priceChange,
      lastUpdate: update.timestamp,
      isLive: true,
    });
  }, []);

  useEffect(() => {
    if (!tokenAddress) return;

    const service = getRealtimeService();
    const unsubscribe = service.subscribe(chainId, tokenAddress, handleUpdate);

    return () => {
      unsubscribe();
    };
  }, [chainId, tokenAddress, handleUpdate]);

  return state;
}
