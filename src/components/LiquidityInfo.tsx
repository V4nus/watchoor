'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatNumber } from '@/lib/api';

// LP Position from streaming API
interface StreamLPPosition {
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  liquidityDelta?: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: 'mint' | 'burn';
}

interface LiquidityLevel {
  price: number;
  liquidityUSD: number;
  type: 'bid' | 'ask';
  token0Amount?: number;
  token1Amount?: number;
  tickLower?: number;
  tickUpper?: number;
}

interface LPPositionDisplay {
  owner: string;
  ownerShort: string;
  priceLower: number;
  priceUpper: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  liquidityNum: number;
  // Calculated token amounts
  usdcAmount: number;
  pingAmount: number;
  type: string;
  timestamp: string;
  txHash: string;
}

interface LiquidityInfoProps {
  selectedLevel: LiquidityLevel | null;
  currentPrice: number;
  totalBidLiquidity: number;
  totalAskLiquidity: number;
  token0Symbol: string;
  token1Symbol: string;
  chainId?: string;
  poolAddress?: string;
  onClose?: () => void;
}

export default function LiquidityInfo({
  selectedLevel,
  currentPrice,
  totalBidLiquidity,
  totalAskLiquidity,
  token0Symbol,
  token1Symbol,
  chainId,
  poolAddress,
  onClose,
}: LiquidityInfoProps) {
  const [positions, setPositions] = useState<LPPositionDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [stats, setStats] = useState<{ mints: number; burns: number; uniqueLPs: number } | null>(null);
  const [dataSource, setDataSource] = useState<string>('');

  // Fetch LP positions with streaming progress
  const fetchPositions = useCallback(async () => {
    if (!selectedLevel || !chainId || !poolAddress) return;

    setLoading(true);
    setLoadingProgress(0);
    setLoadingMessage('Starting...');
    setPositions([]);
    setStats(null);

    try {
      const params = new URLSearchParams({
        chainId,
        poolAddress,
        price: selectedLevel.price.toString(),
        tickRange: '2000',
        token0Symbol,
        token1Symbol,
        limit: '20',
      });

      // Use streaming endpoint for V4 pools
      const isV4 = poolAddress.length === 66;

      if (isV4) {
        // Use SSE for progress updates
        const streamParams = new URLSearchParams({
          chainId,
          poolAddress,
          limit: '40',
        });

        const eventSource = new EventSource(`/api/lp-positions/stream?${streamParams}`);

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);

          setLoadingProgress(data.progress || 0);
          setLoadingMessage(data.message || '');

          if (data.status === 'complete' && data.data) {
            // Get the tick range from the clicked level
            const levelTickLower = selectedLevel.tickLower;
            const levelTickUpper = selectedLevel.tickUpper;

            // Filter positions that overlap with the clicked level's tick range
            const overlappingPositions = (data.data.positions || [])
              .filter((pos: StreamLPPosition) => {
                // If level has tick range, filter positions that overlap with it
                if (levelTickLower !== undefined && levelTickUpper !== undefined) {
                  return pos.tickLower <= levelTickUpper && pos.tickUpper >= levelTickLower;
                }
                return true;
              });

            // Aggregate by tick range to calculate NET liquidity
            const tickRangeMap = new Map<string, {
              tickLower: number;
              tickUpper: number;
              netLiquidity: bigint;
              mintCount: number;
              burnCount: number;
              owners: Set<string>;
              lastTxHash: string;
              lastTimestamp: number;
            }>();

            for (const pos of overlappingPositions) {
              const key = `${pos.tickLower}-${pos.tickUpper}`;
              const liqStr = (pos.liquidityDelta || pos.liquidity || '0');
              const liqValue = BigInt(liqStr.replace('-', ''));
              const isMint = pos.type === 'mint';

              if (!tickRangeMap.has(key)) {
                tickRangeMap.set(key, {
                  tickLower: pos.tickLower,
                  tickUpper: pos.tickUpper,
                  netLiquidity: 0n,
                  mintCount: 0,
                  burnCount: 0,
                  owners: new Set(),
                  lastTxHash: pos.txHash,
                  lastTimestamp: pos.timestamp,
                });
              }

              const entry = tickRangeMap.get(key)!;
              if (isMint) {
                entry.netLiquidity += liqValue;
                entry.mintCount++;
              } else {
                entry.netLiquidity -= liqValue;
                entry.burnCount++;
              }
              entry.owners.add(pos.owner);
              if (pos.timestamp > entry.lastTimestamp) {
                entry.lastTimestamp = pos.timestamp;
                entry.lastTxHash = pos.txHash;
              }
            }

            // Convert to display format - only show ranges with positive net liquidity
            const aggregatedPositions: LPPositionDisplay[] = [];
            for (const [, entry] of tickRangeMap) {
              if (entry.netLiquidity <= 0n) continue; // Skip if no active liquidity

              const netLiqStr = entry.netLiquidity.toString();
              const netLiqNum = parseFloat(netLiqStr);
              const priceLower = tickToPrice(entry.tickLower);
              const priceUpper = tickToPrice(entry.tickUpper);
              const { usdc, ping } = calculateTokenAmounts(netLiqStr, entry.tickLower, entry.tickUpper);

              aggregatedPositions.push({
                owner: `${entry.owners.size} LPs`,
                ownerShort: `${entry.owners.size} LPs`,
                priceLower,
                priceUpper,
                tickLower: entry.tickLower,
                tickUpper: entry.tickUpper,
                liquidity: netLiqStr,
                liquidityNum: netLiqNum,
                usdcAmount: usdc,
                pingAmount: ping,
                type: `+${entry.mintCount} / -${entry.burnCount}`,
                timestamp: new Date(entry.lastTimestamp * 1000).toLocaleString(),
                txHash: entry.lastTxHash,
              });
            }

            // Sort by net liquidity (largest first)
            aggregatedPositions.sort((a, b) => b.liquidityNum - a.liquidityNum);

            setPositions(aggregatedPositions.slice(0, 20));
            setStats({
              mints: overlappingPositions.filter((p: StreamLPPosition) => p.type === 'mint').length,
              burns: overlappingPositions.filter((p: StreamLPPosition) => p.type === 'burn').length,
              uniqueLPs: new Set(overlappingPositions.map((p: StreamLPPosition) => p.owner)).size,
            });
            setDataSource(data.data.source || '');
            setLoading(false);
            eventSource.close();
          } else if (data.status === 'error') {
            console.error('LP positions error:', data.message);
            setLoading(false);
            eventSource.close();
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          // Fallback to regular API
          fetchPositionsFallback(params);
        };
      } else {
        // Use regular API for V3 pools
        await fetchPositionsFallback(params);
      }
    } catch (error) {
      console.error('Failed to fetch LP positions:', error);
      setPositions([]);
      setLoading(false);
    }
  }, [selectedLevel, chainId, poolAddress, token0Symbol, token1Symbol]);

  // Fallback fetch without streaming
  const fetchPositionsFallback = async (params: URLSearchParams) => {
    try {
      setLoadingMessage('Loading positions...');
      setLoadingProgress(50);

      const response = await fetch(`/api/lp-positions?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        setPositions(result.data.positions || []);
        setStats(result.data.stats || null);
        setDataSource(result.data.source || 'rpc');
      }
    } catch (error) {
      console.error('Fallback fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format large liquidity numbers
  const formatLiquidity = (liq: string): string => {
    const num = BigInt(liq);
    if (num >= BigInt(10 ** 18)) {
      return (Number(num / BigInt(10 ** 15)) / 1000).toFixed(2) + ' x10^18';
    } else if (num >= BigInt(10 ** 15)) {
      return (Number(num / BigInt(10 ** 12)) / 1000).toFixed(2) + ' x10^15';
    } else if (num >= BigInt(10 ** 12)) {
      return (Number(num / BigInt(10 ** 9)) / 1000).toFixed(2) + ' x10^12';
    } else if (num >= BigInt(10 ** 9)) {
      return (Number(num) / 10 ** 9).toFixed(2) + 'B';
    } else if (num >= BigInt(10 ** 6)) {
      return (Number(num) / 10 ** 6).toFixed(2) + 'M';
    } else if (num >= BigInt(10 ** 3)) {
      return (Number(num) / 10 ** 3).toFixed(2) + 'K';
    }
    return num.toString();
  };

  // Convert tick to price (USDC per PING)
  // In Uniswap V4: token0=USDC (6 decimals), token1=PING (18 decimals)
  // rawPrice = 1.0001^tick = PING_wei / USDC_wei
  // usdcPerPing = 10^(token0_decimals + token1_decimals - token1_decimals) / rawPrice = 10^12 / rawPrice
  const tickToPrice = (tick: number): number => {
    // Handle extreme ticks (full range positions)
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;

    if (tick <= MIN_TICK + 1000) {
      return 0; // Represents "minimum price" (essentially 0)
    }
    if (tick >= MAX_TICK - 1000) {
      return Infinity; // Represents "maximum price"
    }

    // Calculate raw price
    const rawPrice = Math.pow(1.0001, tick);

    // USDC per PING = 10^12 / rawPrice
    // (because rawPrice = PING_wei/USDC_wei, and we need to adjust for 18-6=12 decimal difference)
    const usdcPerPing = Math.pow(10, 12) / rawPrice;

    return usdcPerPing;
  };

  // Calculate token amounts from liquidity and tick range
  // For USDC (6 decimals) / PING (18 decimals) pair
  // In Uniswap V3/V4:
  //   amount0 = L * (1/sqrt(P_lower) - 1/sqrt(P_upper))  [in wei]
  //   amount1 = L * (sqrt(P_upper) - sqrt(P_lower))      [in wei]
  // where P = 1.0001^tick (raw price in wei terms)
  const calculateTokenAmounts = (
    liquidity: string,
    tickLower: number,
    tickUpper: number
  ): { usdc: number; ping: number } => {
    try {
      const L = parseFloat(liquidity);
      if (L <= 0 || !isFinite(L)) return { usdc: 0, ping: 0 };

      // Handle extreme ticks
      const MIN_TICK = -887272;
      const MAX_TICK = 887272;
      const effectiveTickLower = Math.max(tickLower, MIN_TICK);
      const effectiveTickUpper = Math.min(tickUpper, MAX_TICK);

      // Calculate sqrt prices from ticks
      // sqrtPrice = sqrt(1.0001^tick) = 1.0001^(tick/2)
      const sqrtPriceLower = Math.pow(1.0001, effectiveTickLower / 2);
      const sqrtPriceUpper = Math.pow(1.0001, effectiveTickUpper / 2);

      // Calculate token amounts in smallest units (wei)
      // These formulas give the maximum amounts when the position is fully utilized
      const amount0Wei = L * (1 / sqrtPriceLower - 1 / sqrtPriceUpper);
      const amount1Wei = L * (sqrtPriceUpper - sqrtPriceLower);

      // Convert to human readable amounts
      // token0 = USDC (6 decimals), token1 = PING (18 decimals)
      const usdc = amount0Wei / 1e6;
      const ping = amount1Wei / 1e18;

      return { usdc: Math.abs(usdc), ping: Math.abs(ping) };
    } catch {
      return { usdc: 0, ping: 0 };
    }
  };

  // Format token amount for display
  const formatTokenAmount = (amount: number, symbol: string): string => {
    if (amount === 0) return `0 ${symbol}`;
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B ${symbol}`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M ${symbol}`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K ${symbol}`;
    if (amount >= 1) return `${amount.toFixed(2)} ${symbol}`;
    if (amount >= 0.0001) return `${amount.toFixed(4)} ${symbol}`;
    return `${amount.toExponential(2)} ${symbol}`;
  };

  useEffect(() => {
    if (selectedLevel) {
      fetchPositions();
    } else {
      setPositions([]);
      setStats(null);
    }
  }, [selectedLevel, fetchPositions]);

  if (!selectedLevel) {
    return (
      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4 h-full">
        <div className="text-sm font-medium mb-3">LP Positions</div>
        <div className="text-center text-gray-500 text-sm py-8">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p>Click on order flow lines</p>
          <p className="text-xs text-gray-600 mt-1">to see LP position records</p>
        </div>
      </div>
    );
  }

  const isBid = selectedLevel.type === 'bid';
  const totalLiquidity = isBid ? totalBidLiquidity : totalAskLiquidity;
  const percentage = totalLiquidity > 0 ? (selectedLevel.liquidityUSD / totalLiquidity) * 100 : 0;
  const priceChange = currentPrice > 0 ? ((selectedLevel.price - currentPrice) / currentPrice) * 100 : 0;

  const baseAmount = selectedLevel.token0Amount || selectedLevel.liquidityUSD / selectedLevel.price;
  const quoteAmount = selectedLevel.token1Amount || selectedLevel.liquidityUSD;

  // Get explorer URL
  const explorerUrl = {
    base: 'https://basescan.org',
    ethereum: 'https://etherscan.io',
    bsc: 'https://bscscan.com',
    arbitrum: 'https://arbiscan.io',
    polygon: 'https://polygonscan.com',
  }[chainId || ''] || 'https://etherscan.io';

  return (
    <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-3 h-full overflow-auto">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <span>LP Positions</span>
          <span className={`text-xs px-2 py-0.5 rounded ${isBid ? 'bg-[#3fb950]/20 text-[#3fb950]' : 'bg-[#f85149]/20 text-[#f85149]'}`}>
            {isBid ? 'Support' : 'Resistance'}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#30363d] rounded text-gray-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Price Level Summary */}
      <div className="mb-3 p-2 bg-[#0d1117] rounded">
        <div className="flex justify-between items-center">
          <div>
            <div className={`text-lg font-bold ${isBid ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              ${formatNumber(selectedLevel.price)}
            </div>
            <div className={`text-xs ${priceChange >= 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% from current
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">${formatNumber(selectedLevel.liquidityUSD)}</div>
            <div className="text-xs text-gray-400">{percentage.toFixed(1)}% of total</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-[#0d1117] rounded p-2 text-center">
              <div className="text-[#3fb950] font-medium">{stats.mints}</div>
              <div className="text-gray-500">Mints</div>
            </div>
            <div className="bg-[#0d1117] rounded p-2 text-center">
              <div className="text-[#f85149] font-medium">{stats.burns}</div>
              <div className="text-gray-500">Burns</div>
            </div>
            <div className="bg-[#0d1117] rounded p-2 text-center">
              <div className="text-[#58a6ff] font-medium">{stats.uniqueLPs}</div>
              <div className="text-gray-500">LPs</div>
            </div>
          </div>
          {dataSource && (
            <div className="mt-2 text-center">
              <span className={`text-[10px] px-2 py-0.5 rounded ${
                dataSource === 'dune'
                  ? 'bg-purple-500/20 text-purple-400'
                  : dataSource === 'database'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                via {dataSource === 'dune' ? 'Dune Analytics' : dataSource === 'database' ? 'Local DB' : 'RPC'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* LP Position Records */}
      <div className="text-xs font-medium text-gray-400 mb-2">Net Liquidity by Tick Range</div>

      {loading ? (
        <div className="py-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">{loadingMessage}</span>
              <span className="text-[#58a6ff]">{loadingProgress}%</span>
            </div>
            <div className="w-full h-2 bg-[#21262d] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#58a6ff] to-[#3fb950] transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
          {/* Spinner */}
          <div className="text-center">
            <div className="inline-block w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-xs">
          <p>No position records found</p>
          <p className="mt-1">in this price range</p>
          {poolAddress && poolAddress.length === 66 && (
            <p className="mt-2 text-[#58a6ff]">
              V4 pools require premium RPC for historical data
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {positions.map((pos, index) => (
            <div
              key={index}
              className="bg-[#0d1117] rounded p-2 text-xs border border-[#21262d] hover:border-[#30363d]"
            >
              {/* Header: LP count + mint/burn stats */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[#58a6ff] font-medium">
                  {pos.ownerShort}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#30363d] text-gray-300">
                  {pos.type}
                </span>
              </div>

              {/* Price Range */}
              <div className="mb-2 p-1.5 bg-[#161b22] rounded">
                <div className="text-gray-500 text-[10px] mb-1">Price Range (USDC/PING)</div>
                <div className="flex justify-between text-gray-300">
                  <span>
                    {pos.priceLower === 0 ? 'Min' :
                     pos.priceLower === Infinity ? 'Max' :
                     pos.priceLower > 0.000001 ? `$${pos.priceLower.toFixed(6)}` :
                     `$${pos.priceLower.toExponential(2)}`}
                  </span>
                  <span className="text-gray-500">-</span>
                  <span>
                    {pos.priceUpper === 0 ? 'Min' :
                     pos.priceUpper === Infinity ? 'Max' :
                     pos.priceUpper > 0.000001 ? `$${pos.priceUpper.toFixed(6)}` :
                     `$${pos.priceUpper.toExponential(2)}`}
                  </span>
                </div>
              </div>

              {/* Net Liquidity - calculated from aggregated data */}
              <div className="mb-2 p-1.5 bg-[#161b22] rounded">
                <div className="text-gray-500 text-[10px] mb-1">
                  Net {isBid ? 'USDC' : 'PING'} Liquidity
                </div>
                <div className={`font-medium text-sm ${isBid ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                  {isBid
                    ? formatTokenAmount(pos.usdcAmount, 'USDC')
                    : formatTokenAmount(pos.pingAmount, 'PING')
                  }
                </div>
              </div>

              {/* Footer: Last update + TX */}
              <div className="flex justify-between pt-1 border-t border-[#21262d] text-[10px]">
                <span className="text-gray-600">Last: {pos.timestamp}</span>
                <a
                  href={`${explorerUrl}/tx/${pos.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#58a6ff] hover:underline"
                >
                  View TX
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Depth Summary */}
      <div className="mt-3 pt-3 border-t border-[#30363d]">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-gray-400">Total Bids</div>
            <div className="text-[#3fb950] font-medium">${formatNumber(totalBidLiquidity)}</div>
          </div>
          <div>
            <div className="text-gray-400">Total Asks</div>
            <div className="text-[#f85149] font-medium">${formatNumber(totalAskLiquidity)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
