'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { PriceUpdate, TradeUpdate } from '@/hooks/useWebSocket';

interface PoolData {
  priceUsd: number;
  priceNative: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  lastUpdate: number;
}

interface RealtimeContextType {
  // Pool data cache
  poolData: Map<string, PoolData>;
  trades: Map<string, TradeUpdate[]>;

  // Subscribe to pool updates
  subscribeToPool: (chainId: string, poolAddress: string) => void;
  unsubscribeFromPool: (chainId: string, poolAddress: string) => void;

  // Get pool data
  getPoolData: (chainId: string, poolAddress: string) => PoolData | undefined;
  getTrades: (chainId: string, poolAddress: string) => TradeUpdate[];

  // Update methods (for polling fallback)
  updatePoolData: (chainId: string, poolAddress: string, data: Partial<PoolData>) => void;
  addTrade: (chainId: string, poolAddress: string, trade: TradeUpdate) => void;

  // Connection status
  isConnected: boolean;
  usePolling: boolean;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

interface RealtimeProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export function RealtimeProvider({ children, pollingInterval = 5000 }: RealtimeProviderProps) {
  const [poolData, setPoolData] = useState<Map<string, PoolData>>(new Map());
  const [trades, setTrades] = useState<Map<string, TradeUpdate[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [usePolling, setUsePolling] = useState(true); // Default to polling

  const subscribedPoolsRef = useRef<Set<string>>(new Set());
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getPoolKey = (chainId: string, poolAddress: string) => `${chainId}:${poolAddress}`;

  const subscribeToPool = useCallback((chainId: string, poolAddress: string) => {
    const key = getPoolKey(chainId, poolAddress);

    if (subscribedPoolsRef.current.has(key)) {
      return;
    }

    subscribedPoolsRef.current.add(key);

    // For now, use polling fallback
    if (usePolling) {
      // Initial fetch
      fetchPoolData(chainId, poolAddress);
      fetchTrades(chainId, poolAddress);

      // Set up polling interval
      const interval = setInterval(() => {
        fetchPoolData(chainId, poolAddress);
        fetchTrades(chainId, poolAddress);
      }, pollingInterval);

      pollingIntervalsRef.current.set(key, interval);
    }
  }, [usePolling, pollingInterval]);

  const unsubscribeFromPool = useCallback((chainId: string, poolAddress: string) => {
    const key = getPoolKey(chainId, poolAddress);

    subscribedPoolsRef.current.delete(key);

    // Clear polling interval
    const interval = pollingIntervalsRef.current.get(key);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(key);
    }
  }, []);

  const fetchPoolData = async (chainId: string, poolAddress: string) => {
    try {
      const response = await fetch(`/api/pool?chainId=${chainId}&poolAddress=${poolAddress}`);
      const result = await response.json();

      if (result.success && result.data) {
        const key = getPoolKey(chainId, poolAddress);
        setPoolData((prev) => {
          const next = new Map(prev);
          next.set(key, {
            priceUsd: result.data.priceUsd,
            priceNative: result.data.priceNative,
            priceChange24h: result.data.priceChange24h,
            volume24h: result.data.volume24h,
            liquidity: result.data.liquidity,
            lastUpdate: Date.now(),
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Error fetching pool data:', error);
    }
  };

  const fetchTrades = async (chainId: string, poolAddress: string) => {
    try {
      const response = await fetch(`/api/trades?chainId=${chainId}&poolAddress=${poolAddress}&limit=50`);
      const result = await response.json();

      if (result.success && result.data) {
        const key = getPoolKey(chainId, poolAddress);
        setTrades((prev) => {
          const next = new Map(prev);
          next.set(key, result.data);
          return next;
        });
      }
    } catch (error) {
      console.error('Error fetching trades:', error);
    }
  };

  const getPoolData = useCallback((chainId: string, poolAddress: string) => {
    return poolData.get(getPoolKey(chainId, poolAddress));
  }, [poolData]);

  const getTrades = useCallback((chainId: string, poolAddress: string) => {
    return trades.get(getPoolKey(chainId, poolAddress)) || [];
  }, [trades]);

  const updatePoolData = useCallback((chainId: string, poolAddress: string, data: Partial<PoolData>) => {
    const key = getPoolKey(chainId, poolAddress);
    setPoolData((prev) => {
      const next = new Map(prev);
      const existing = prev.get(key) || {
        priceUsd: 0,
        priceNative: 0,
        priceChange24h: 0,
        volume24h: 0,
        liquidity: 0,
        lastUpdate: Date.now(),
      };
      next.set(key, { ...existing, ...data, lastUpdate: Date.now() });
      return next;
    });
  }, []);

  const addTrade = useCallback((chainId: string, poolAddress: string, trade: TradeUpdate) => {
    const key = getPoolKey(chainId, poolAddress);
    setTrades((prev) => {
      const next = new Map(prev);
      const existing = prev.get(key) || [];
      next.set(key, [trade, ...existing].slice(0, 50));
      return next;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach((interval) => clearInterval(interval));
      pollingIntervalsRef.current.clear();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        poolData,
        trades,
        subscribeToPool,
        unsubscribeFromPool,
        getPoolData,
        getTrades,
        updatePoolData,
        addTrade,
        isConnected,
        usePolling,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
}

// Convenience hook for subscribing to a specific pool
export function usePoolRealtime(chainId: string, poolAddress: string) {
  const { subscribeToPool, unsubscribeFromPool, getPoolData, getTrades, isConnected, usePolling } = useRealtime();

  useEffect(() => {
    if (chainId && poolAddress) {
      subscribeToPool(chainId, poolAddress);
      return () => unsubscribeFromPool(chainId, poolAddress);
    }
  }, [chainId, poolAddress, subscribeToPool, unsubscribeFromPool]);

  return {
    poolData: getPoolData(chainId, poolAddress),
    trades: getTrades(chainId, poolAddress),
    isConnected,
    usePolling,
  };
}
