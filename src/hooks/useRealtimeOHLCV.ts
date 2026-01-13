'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getRealtimeService, RealtimeBar, OHLCVUpdate } from '@/lib/realtime';
import { CandlestickData, Time } from 'lightweight-charts';

interface UseRealtimeOHLCVOptions {
  chainId: string;
  tokenAddress: string;
  interval: string;
  initialData: CandlestickData<Time>[];
}

interface UseRealtimeOHLCVResult {
  data: CandlestickData<Time>[];
  latestBar: RealtimeBar | null;
  isLive: boolean;
}

export function useRealtimeOHLCV({
  chainId,
  tokenAddress,
  interval,
  initialData,
}: UseRealtimeOHLCVOptions): UseRealtimeOHLCVResult {
  const [data, setData] = useState<CandlestickData<Time>[]>(initialData);
  const [latestBar, setLatestBar] = useState<RealtimeBar | null>(null);
  const [isLive, setIsLive] = useState(false);
  const dataRef = useRef<CandlestickData<Time>[]>(initialData);

  // Update ref when initial data changes
  useEffect(() => {
    dataRef.current = initialData;
    setData(initialData);
  }, [initialData]);

  const handleOHLCVUpdate = useCallback((update: OHLCVUpdate) => {
    const { bar, isNewBar } = update;
    setLatestBar(bar);
    setIsLive(true);

    setData((prevData) => {
      const newData = [...prevData];
      const barData: CandlestickData<Time> = {
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      };

      if (isNewBar) {
        // Add new bar
        newData.push(barData);
      } else {
        // Update last bar
        if (newData.length > 0) {
          const lastIndex = newData.length - 1;
          const lastBar = newData[lastIndex];

          // Only update if same time period
          if (lastBar.time === bar.time) {
            newData[lastIndex] = barData;
          } else if ((lastBar.time as number) < bar.time) {
            // New bar with different time
            newData.push(barData);
          }
        } else {
          newData.push(barData);
        }
      }

      dataRef.current = newData;
      return newData;
    });
  }, []);

  useEffect(() => {
    if (!tokenAddress || !chainId) return;

    const service = getRealtimeService();

    // Get initial bar from latest data
    const lastCandle = initialData[initialData.length - 1];
    const initialBar: RealtimeBar | null = lastCandle ? {
      time: lastCandle.time as number,
      open: lastCandle.open,
      high: lastCandle.high,
      low: lastCandle.low,
      close: lastCandle.close,
      volume: 0,
    } : null;

    const unsubscribe = service.subscribeOHLCV(
      chainId,
      tokenAddress,
      interval,
      initialBar,
      handleOHLCVUpdate
    );

    return () => {
      unsubscribe();
      setIsLive(false);
    };
  }, [chainId, tokenAddress, interval, initialData, handleOHLCVUpdate]);

  return { data, latestBar, isLive };
}
