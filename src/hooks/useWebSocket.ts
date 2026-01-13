'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: 'price' | 'trade' | 'ohlcv' | 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  data?: unknown;
  channel?: string;
  error?: string;
}

export interface PriceUpdate {
  chainId: string;
  poolAddress: string;
  priceUsd: number;
  priceNative: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  timestamp: number;
}

export interface TradeUpdate {
  chainId: string;
  poolAddress: string;
  txHash: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  volumeUsd: number;
  timestamp: string;
  blockNumber: number;
}

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onPriceUpdate?: (update: PriceUpdate) => void;
  onTradeUpdate?: (update: TradeUpdate) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  send: (message: WebSocketMessage) => void;
  reconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onPriceUpdate,
  onTradeUpdate,
  onError,
  onConnect,
  onDisconnect,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onConnect?.();

        // Resubscribe to channels after reconnection
        subscribedChannelsRef.current.forEach((channel) => {
          ws.send(JSON.stringify({ type: 'subscribe', channel }));
        });

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle pong
          if (message.type === 'pong') {
            return;
          }

          // Handle price updates
          if (message.type === 'price' && message.data) {
            onPriceUpdate?.(message.data as PriceUpdate);
          }

          // Handle trade updates
          if (message.type === 'trade' && message.data) {
            onTradeUpdate?.(message.data as TradeUpdate);
          }

          // General message handler
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`Reconnecting... attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [url, cleanup, onConnect, onDisconnect, onError, onMessage, onPriceUpdate, onTradeUpdate, reconnectInterval, maxReconnectAttempts]);

  const subscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.add(channel);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    subscribedChannelsRef.current.delete(channel);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }, []);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    send,
    reconnect,
  };
}

// Helper hook for pool-specific real-time data
export function usePoolWebSocket(chainId: string, poolAddress: string) {
  const [priceData, setPriceData] = useState<PriceUpdate | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // For now, use polling fallback since we don't have a real WebSocket server
  // This can be replaced with actual WebSocket when server is ready
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || '';

  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    if (update.chainId === chainId && update.poolAddress === poolAddress) {
      setPriceData(update);
    }
  }, [chainId, poolAddress]);

  const handleTradeUpdate = useCallback((update: TradeUpdate) => {
    if (update.chainId === chainId && update.poolAddress === poolAddress) {
      setRecentTrades((prev) => {
        // Keep only last 50 trades
        const updated = [update, ...prev].slice(0, 50);
        return updated;
      });
    }
  }, [chainId, poolAddress]);

  const { subscribe, unsubscribe, reconnect } = useWebSocket({
    url: wsUrl,
    onPriceUpdate: handlePriceUpdate,
    onTradeUpdate: handleTradeUpdate,
    onConnect: () => setIsConnected(true),
    onDisconnect: () => setIsConnected(false),
  });

  useEffect(() => {
    if (wsUrl && chainId && poolAddress) {
      const channel = `pool:${chainId}:${poolAddress}`;
      subscribe(channel);
      return () => unsubscribe(channel);
    }
  }, [chainId, poolAddress, wsUrl, subscribe, unsubscribe]);

  return {
    priceData,
    recentTrades,
    isConnected,
    reconnect,
  };
}
