'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { formatNumber } from '@/lib/api';
import { useTranslations } from '@/lib/i18n';
import { usePoolRealtime } from '@/lib/realtime-provider';
import { RefreshCw, Wifi } from 'lucide-react';

// Get block explorer URL for transaction
const getExplorerUrl = (chainId: string, txHash: string): string => {
  const explorers: Record<string, string> = {
    ethereum: 'https://etherscan.io/tx/',
    base: 'https://basescan.org/tx/',
    bsc: 'https://bscscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/',
    avalanche: 'https://snowtrace.io/tx/',
  };
  const baseUrl = explorers[chainId] || 'https://etherscan.io/tx/';
  return `${baseUrl}${txHash}`;
};

interface Trade {
  txHash: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  volumeUsd: number;
  timestamp: string;
  blockNumber: number;
}

interface TradeHistoryProps {
  chainId: string;
  poolAddress: string;
  baseSymbol: string;
  priceUsd: number;
}

export default function TradeHistory({
  chainId,
  poolAddress,
  baseSymbol,
  priceUsd,
}: TradeHistoryProps) {
  const t = useTranslations();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set());
  const prevTradesRef = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Use realtime context for connection status
  const { usePolling, isConnected } = usePoolRealtime(chainId, poolAddress);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await fetch(
          `/api/trades?chainId=${chainId}&poolAddress=${poolAddress}&limit=50`
        );
        const result = await response.json();

        if (result.success && result.data) {
          const newTrades = result.data as Trade[];

          // Only update if we got data (don't clear existing data on empty response)
          if (newTrades.length > 0 || isInitialLoad.current) {
            // Detect new trades for highlighting
            if (!isInitialLoad.current) {
              const newIds = new Set<string>();
              newTrades.forEach((trade) => {
                if (!prevTradesRef.current.has(trade.txHash)) {
                  newIds.add(trade.txHash);
                }
              });

              if (newIds.size > 0) {
                setNewTradeIds(newIds);
                // Clear highlights after animation
                setTimeout(() => setNewTradeIds(new Set()), 1000);
              }
            }

            // Update prev trades ref
            prevTradesRef.current = new Set(newTrades.map((t) => t.txHash));

            // Sort by timestamp descending (newest first)
            const sortedTrades = newTrades.sort((a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );

            setTrades(sortedTrades);
            setError(null);
          }
          // If empty response on refresh, keep existing data
        } else if (result.message) {
          // V4 pool message
          setError(result.message);
        }
      } catch (err) {
        console.error('Failed to fetch trades:', err);
        if (isInitialLoad.current) {
          setError('Failed to load trades');
        }
      } finally {
        if (isInitialLoad.current) {
          setLoading(false);
          isInitialLoad.current = false;
        }
      }
    };

    fetchTrades();
    // Refresh every 5 seconds (polling mode)
    const interval = setInterval(fetchTrades, 5000);
    return () => clearInterval(interval);
  }, [chainId, poolAddress]);

  // Format time to HH:MM
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format price with appropriate precision
  const formatPrice = (price: number) => {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.0001) return price.toFixed(6);
    if (price >= 0.00000001) return price.toFixed(8);
    return price.toExponential(4);
  };

  if (loading) {
    return (
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4 h-full">
        <div className="text-sm font-medium mb-3">{t.tradeHistory.title}</div>
        <div className="text-center text-gray-400 animate-pulse py-8">
          {t.tradeHistory.loadingTrades}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4 h-full">
        <div className="text-sm font-medium mb-3">{t.tradeHistory.title}</div>
        <div className="text-center text-gray-500 text-sm py-8">{error}</div>
      </div>
    );
  }

  // Calculate buy/sell stats
  const recentTrades = trades.slice(0, 20);
  const buyCount = recentTrades.filter((t) => t.type === 'buy').length;
  const sellCount = recentTrades.filter((t) => t.type === 'sell').length;
  const buyVolume = recentTrades
    .filter((t) => t.type === 'buy')
    .reduce((sum, t) => sum + t.volumeUsd, 0);
  const sellVolume = recentTrades
    .filter((t) => t.type === 'sell')
    .reduce((sum, t) => sum + t.volumeUsd, 0);

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#30363d] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{t.tradeHistory.title}</span>
            {/* Connection status indicator */}
            <div className="flex items-center gap-1" title={usePolling ? 'Polling mode (5s)' : isConnected ? 'WebSocket connected' : 'Disconnected'}>
              {usePolling ? (
                <RefreshCw size={12} className="text-yellow-500 animate-spin" style={{ animationDuration: '3s' }} />
              ) : isConnected ? (
                <Wifi size={12} className="text-[#3fb950]" />
              ) : (
                <Wifi size={12} className="text-[#f85149]" />
              )}
            </div>
          </div>
          <span className="text-sm text-gray-400">{trades.length} {t.tradeHistory.trades}</span>
        </div>
        {/* Buy/Sell summary bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-[#3fb950]"
              style={{
                width: `${buyCount + sellCount > 0 ? (buyCount / (buyCount + sellCount)) * 100 : 50}%`,
              }}
            />
            <div
              className="h-full bg-[#f85149]"
              style={{
                width: `${buyCount + sellCount > 0 ? (sellCount / (buyCount + sellCount)) * 100 : 50}%`,
              }}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#3fb950]">{buyCount}B</span>
            <span className="text-gray-500">/</span>
            <span className="text-[#f85149]">{sellCount}S</span>
          </div>
        </div>
      </div>

      {/* Trades table - fills remaining space */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="text-gray-400 sticky top-0 bg-[#161b22]">
            <tr className="border-b border-[#21262d]">
              <th className="text-left px-2 py-2 font-normal">{t.common.price}</th>
              <th className="text-right px-2 py-2 font-normal hidden sm:table-cell">{baseSymbol}</th>
              <th className="text-right px-2 py-2 font-normal">USD</th>
              <th className="text-right px-2 py-2 font-normal">{t.common.time}</th>
              <th className="text-right px-2 py-2 font-normal hidden sm:table-cell">{t.tradeHistory.tx}</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-8">{t.tradeHistory.noTrades}</td>
              </tr>
            ) : (
              trades.map((trade) => {
                const isNew = newTradeIds.has(trade.txHash);
                const isBuy = trade.type === 'buy';

                return (
                  <tr
                    key={trade.txHash}
                    className={`hover:bg-[#21262d] transition-colors ${
                      isNew ? (isBuy ? 'animate-flash-green' : 'animate-flash-red') : ''
                    }`}
                  >
                    <td className={`px-2 py-1.5 whitespace-nowrap text-xs sm:text-sm ${isBuy ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                      ${formatPrice(trade.price)}
                    </td>
                    <td className="text-right px-2 py-1.5 text-gray-300 whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">
                      {formatNumber(trade.amount)}
                    </td>
                    <td className="text-right px-2 py-1.5 text-gray-300 whitespace-nowrap text-xs sm:text-sm">
                      ${trade.volumeUsd >= 1000 ? formatNumber(trade.volumeUsd) : trade.volumeUsd.toFixed(0)}
                    </td>
                    <td className="text-right px-2 py-1.5 text-gray-400 whitespace-nowrap text-xs sm:text-sm">
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="text-right px-2 py-1.5 whitespace-nowrap hidden sm:table-cell">
                      <a
                        href={getExplorerUrl(chainId, trade.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#58a6ff] hover:text-[#79c0ff] hover:underline text-sm"
                        title={trade.txHash}
                      >
                        tx
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Volume summary */}
      <div className="px-3 py-2 border-t border-[#30363d] text-sm flex-shrink-0">
        <div className="flex justify-between text-gray-400">
          <span>{t.tradeHistory.recentVolume}</span>
          <span>${formatNumber(buyVolume + sellVolume)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[#3fb950]">{t.trade.buy}: ${formatNumber(buyVolume)}</span>
          <span className="text-[#f85149]">{t.trade.sell}: ${formatNumber(sellVolume)}</span>
        </div>
      </div>
    </div>
  );
}
