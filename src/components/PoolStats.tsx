'use client';

import { PoolInfo } from '@/types';
import { formatNumber, formatPrice, formatPercentage } from '@/lib/api';
import { ExternalLink, Copy, Check, RefreshCw } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslations } from '@/lib/i18n';
import { usePoolRealtime } from '@/lib/realtime-provider';

interface PoolStatsProps {
  pool: PoolInfo;
}

export default function PoolStats({ pool }: PoolStatsProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState<string | null>(null);

  // Subscribe to realtime updates for this pool
  const { poolData, usePolling } = usePoolRealtime(pool.chainId, pool.poolAddress);

  // Merge initial pool data with realtime updates
  const displayData = useMemo(() => {
    if (poolData) {
      return {
        priceUsd: poolData.priceUsd || pool.priceUsd,
        priceChange24h: poolData.priceChange24h ?? pool.priceChange24h,
        volume24h: poolData.volume24h || pool.volume24h,
        liquidity: poolData.liquidity || pool.liquidity,
      };
    }
    return {
      priceUsd: pool.priceUsd,
      priceChange24h: pool.priceChange24h,
      volume24h: pool.volume24h,
      liquidity: pool.liquidity,
    };
  }, [pool, poolData]);

  const copyAddress = async (address: string, label: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const priceChangeColor = displayData.priceChange24h >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';

  const explorerUrl = {
    base: 'https://basescan.org',
    ethereum: 'https://etherscan.io',
    bsc: 'https://bscscan.com',
    arbitrum: 'https://arbiscan.io',
    polygon: 'https://polygonscan.com',
    solana: 'https://solscan.io',
  }[pool.chainId] || 'https://etherscan.io';

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
      {/* Token pair header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">
              {pool.baseToken.symbol}/{pool.quoteToken.symbol}
            </h1>
            {/* Realtime indicator */}
            {usePolling && (
              <span title="Polling mode (5s)">
                <RefreshCw
                  size={14}
                  className="text-yellow-500 animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {pool.dex.toUpperCase()} on {pool.chainId.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">${formatPrice(displayData.priceUsd)}</p>
          <p className={`text-lg ${priceChangeColor}`}>
            {formatPercentage(displayData.priceChange24h)}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label={t.pool.volume24h} value={`$${formatNumber(displayData.volume24h)}`} />
        <StatCard label={t.pool.liquidity} value={`$${formatNumber(displayData.liquidity)}`} />
        <StatCard label={t.pool.buys24h} value={pool.txns24h.buys.toString()} color="text-[#3fb950]" />
        <StatCard label={t.pool.sells24h} value={pool.txns24h.sells.toString()} color="text-[#f85149]" />
      </div>

      {/* Token addresses */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between p-2 bg-[#0d1117] rounded">
          <span className="text-gray-400">{t.pool.poolAddress}</span>
          <div className="flex items-center gap-2">
            <code className="text-[#58a6ff]">
              {pool.poolAddress.slice(0, 8)}...{pool.poolAddress.slice(-6)}
            </code>
            <button
              onClick={() => copyAddress(pool.poolAddress, 'pool')}
              className="p-1 hover:bg-[#30363d] rounded"
            >
              {copied === 'pool' ? <Check size={14} className="text-[#3fb950]" /> : <Copy size={14} />}
            </button>
            <a
              href={`${explorerUrl}/address/${pool.poolAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-[#30363d] rounded"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-[#0d1117] rounded">
          <span className="text-gray-400">{pool.baseToken.symbol}</span>
          <div className="flex items-center gap-2">
            <code className="text-[#58a6ff]">
              {pool.baseToken.address.slice(0, 8)}...{pool.baseToken.address.slice(-6)}
            </code>
            <button
              onClick={() => copyAddress(pool.baseToken.address, 'base')}
              className="p-1 hover:bg-[#30363d] rounded"
            >
              {copied === 'base' ? <Check size={14} className="text-[#3fb950]" /> : <Copy size={14} />}
            </button>
            <a
              href={`${explorerUrl}/token/${pool.baseToken.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-[#30363d] rounded"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-[#0d1117] rounded">
          <span className="text-gray-400">{pool.quoteToken.symbol}</span>
          <div className="flex items-center gap-2">
            <code className="text-[#58a6ff]">
              {pool.quoteToken.address.slice(0, 8)}...{pool.quoteToken.address.slice(-6)}
            </code>
            <button
              onClick={() => copyAddress(pool.quoteToken.address, 'quote')}
              className="p-1 hover:bg-[#30363d] rounded"
            >
              {copied === 'quote' ? <Check size={14} className="text-[#3fb950]" /> : <Copy size={14} />}
            </button>
            <a
              href={`${explorerUrl}/token/${pool.quoteToken.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-[#30363d] rounded"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[#0d1117] rounded p-3">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
