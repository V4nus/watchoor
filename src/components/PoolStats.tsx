'use client';

import { PoolInfo } from '@/types';
import { formatNumber, formatPrice, formatPercentage } from '@/lib/api';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface PoolStatsProps {
  pool: PoolInfo;
}

export default function PoolStats({ pool }: PoolStatsProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyAddress = async (address: string, label: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const priceChangeColor = pool.priceChange24h >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]';

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
          <h1 className="text-2xl font-bold">
            {pool.baseToken.symbol}/{pool.quoteToken.symbol}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {pool.dex.toUpperCase()} on {pool.chainId.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">${formatPrice(pool.priceUsd)}</p>
          <p className={`text-lg ${priceChangeColor}`}>
            {formatPercentage(pool.priceChange24h)}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="24h Volume" value={`$${formatNumber(pool.volume24h)}`} />
        <StatCard label="Liquidity" value={`$${formatNumber(pool.liquidity)}`} />
        <StatCard label="24h Buys" value={pool.txns24h.buys.toString()} color="text-[#3fb950]" />
        <StatCard label="24h Sells" value={pool.txns24h.sells.toString()} color="text-[#f85149]" />
      </div>

      {/* Token addresses */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between p-2 bg-[#0d1117] rounded">
          <span className="text-gray-400">Pool Address</span>
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
