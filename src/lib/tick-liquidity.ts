/**
 * Tick Liquidity Scanner
 * Directly query pool contract to get liquidity at each tick
 * This is simpler than tracking events - just read current state
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { base } from 'viem/chains';

// V3 Pool ABI for tick data
const V3_POOL_ABI = parseAbi([
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function tickSpacing() external view returns (int24)',
  'function liquidity() external view returns (uint128)',
  'function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
  'function tickBitmap(int16 wordPosition) external view returns (uint256)',
]);

// V4 State View ABI
const V4_STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getTickInfo(bytes32 poolId, int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)',
  'function getTickLiquidity(bytes32 poolId, int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128)',
  'function getTickBitmap(bytes32 poolId, int16 wordPos) external view returns (uint256)',
]);

// Chain configurations
const CHAIN_CONFIGS: Record<string, { rpc: string; v4StateView?: string }> = {
  base: {
    rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    v4StateView: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227', // Base V4 StateView
  },
  ethereum: {
    rpc: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
  },
};

export interface TickLiquidity {
  tick: number;
  liquidityGross: string;  // Total liquidity at this tick
  liquidityNet: string;    // Net change when crossing this tick
  price: number;           // Price at this tick
  priceUsd?: number;       // USD price (if quote token price known)
}

export interface LiquidityCluster {
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  totalLiquidity: string;
  tickCount: number;
  isLarge: boolean;        // True if liquidity is significantly above average
}

// Convert tick to price
export function tickToPrice(tick: number, token0Decimals: number = 18, token1Decimals: number = 18): number {
  const price = Math.pow(1.0001, tick);
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  return price * decimalAdjustment;
}

// Check if address looks like V4 pool ID (32 bytes)
function isV4Pool(address: string): boolean {
  return address.length === 66; // 0x + 64 hex chars = 32 bytes
}

// Get initialized ticks from bitmap
async function getInitializedTicks(
  client: { readContract: ReturnType<typeof createPublicClient>['readContract'] },
  poolAddress: string,
  tickSpacing: number,
  currentTick: number,
  range: number = 5000
): Promise<number[]> {
  const initializedTicks: number[] = [];

  // Calculate word positions to scan
  const minTick = currentTick - range;
  const maxTick = currentTick + range;

  // Each word covers 256 * tickSpacing ticks
  const ticksPerWord = 256 * tickSpacing;
  const minWordPos = Math.floor(minTick / ticksPerWord);
  const maxWordPos = Math.floor(maxTick / ticksPerWord);

  // Batch read bitmap words
  const wordPositions: number[] = [];
  for (let wordPos = minWordPos; wordPos <= maxWordPos; wordPos++) {
    wordPositions.push(wordPos);
  }

  // Read bitmap in batches
  const batchSize = 10;
  for (let i = 0; i < wordPositions.length; i += batchSize) {
    const batch = wordPositions.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (wordPos) => {
        try {
          const bitmap = await client.readContract({
            address: poolAddress as `0x${string}`,
            abi: V3_POOL_ABI,
            functionName: 'tickBitmap',
            args: [wordPos as unknown as number],
          }) as bigint;
          return { wordPos, bitmap };
        } catch {
          return { wordPos, bitmap: 0n };
        }
      })
    );

    // Extract initialized ticks from bitmap
    for (const { wordPos, bitmap } of results) {
      if (bitmap === 0n) continue;

      for (let bit = 0; bit < 256; bit++) {
        if ((bitmap & (1n << BigInt(bit))) !== 0n) {
          const tick = (wordPos * 256 + bit) * tickSpacing;
          if (tick >= minTick && tick <= maxTick) {
            initializedTicks.push(tick);
          }
        }
      }
    }
  }

  return initializedTicks.sort((a, b) => a - b);
}

// Get V4 initialized ticks from bitmap
async function getV4InitializedTicks(
  client: { readContract: ReturnType<typeof createPublicClient>['readContract'] },
  stateViewAddress: string,
  poolId: string,
  tickSpacing: number,
  currentTick: number,
  range: number = 5000
): Promise<number[]> {
  const initializedTicks: number[] = [];

  const minTick = currentTick - range;
  const maxTick = currentTick + range;

  const ticksPerWord = 256 * tickSpacing;
  const minWordPos = Math.floor(minTick / ticksPerWord);
  const maxWordPos = Math.floor(maxTick / ticksPerWord);

  const wordPositions: number[] = [];
  for (let wordPos = minWordPos; wordPos <= maxWordPos; wordPos++) {
    wordPositions.push(wordPos);
  }

  const batchSize = 10;
  for (let i = 0; i < wordPositions.length; i += batchSize) {
    const batch = wordPositions.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (wordPos) => {
        try {
          const bitmap = await client.readContract({
            address: stateViewAddress as `0x${string}`,
            abi: V4_STATE_VIEW_ABI,
            functionName: 'getTickBitmap',
            args: [poolId as `0x${string}`, wordPos as unknown as number],
          }) as bigint;
          return { wordPos, bitmap };
        } catch {
          return { wordPos, bitmap: 0n };
        }
      })
    );

    for (const { wordPos, bitmap } of results) {
      if (bitmap === 0n) continue;

      for (let bit = 0; bit < 256; bit++) {
        if ((bitmap & (1n << BigInt(bit))) !== 0n) {
          const tick = (wordPos * 256 + bit) * tickSpacing;
          if (tick >= minTick && tick <= maxTick) {
            initializedTicks.push(tick);
          }
        }
      }
    }
  }

  return initializedTicks.sort((a, b) => a - b);
}

// Main function: Scan tick liquidity for V3 pool
export async function scanV3TickLiquidity(
  chainId: string,
  poolAddress: string,
  token0Decimals: number = 18,
  token1Decimals: number = 18,
  tickRange: number = 5000
): Promise<{ currentTick: number; ticks: TickLiquidity[]; totalLiquidity: string }> {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);

  const client = createPublicClient({
    chain: base,
    transport: http(config.rpc),
  });

  // Get current pool state
  const [slot0, tickSpacing, liquidity] = await Promise.all([
    client.readContract({
      address: poolAddress as `0x${string}`,
      abi: V3_POOL_ABI,
      functionName: 'slot0',
    }) as Promise<[bigint, number, number, number, number, number, boolean]>,
    client.readContract({
      address: poolAddress as `0x${string}`,
      abi: V3_POOL_ABI,
      functionName: 'tickSpacing',
    }) as Promise<number>,
    client.readContract({
      address: poolAddress as `0x${string}`,
      abi: V3_POOL_ABI,
      functionName: 'liquidity',
    }) as Promise<bigint>,
  ]);

  const currentTick = slot0[1];
  console.log(`[TickLiquidity] Pool ${poolAddress.slice(0, 10)}... currentTick=${currentTick}, tickSpacing=${tickSpacing}`);

  // Get initialized ticks
  const initializedTicks = await getInitializedTicks(client, poolAddress, tickSpacing, currentTick, tickRange);
  console.log(`[TickLiquidity] Found ${initializedTicks.length} initialized ticks`);

  // Query liquidity for each initialized tick
  const tickLiquidities: TickLiquidity[] = [];
  const batchSize = 20;

  for (let i = 0; i < initializedTicks.length; i += batchSize) {
    const batch = initializedTicks.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (tick) => {
        try {
          const tickData = await client.readContract({
            address: poolAddress as `0x${string}`,
            abi: V3_POOL_ABI,
            functionName: 'ticks',
            args: [tick],
          }) as [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];

          return {
            tick,
            liquidityGross: tickData[0].toString(),
            liquidityNet: tickData[1].toString(),
            price: tickToPrice(tick, token0Decimals, token1Decimals),
          };
        } catch {
          return null;
        }
      })
    );

    tickLiquidities.push(...results.filter((r): r is TickLiquidity => r !== null));
  }

  return {
    currentTick,
    ticks: tickLiquidities,
    totalLiquidity: liquidity.toString(),
  };
}

// Main function: Scan tick liquidity for V4 pool
export async function scanV4TickLiquidity(
  chainId: string,
  poolId: string,
  token0Decimals: number = 18,
  token1Decimals: number = 18,
  tickRange: number = 5000,
  tickSpacing: number = 200 // Default for V4, should be passed from pool info
): Promise<{ currentTick: number; ticks: TickLiquidity[]; totalLiquidity: string }> {
  const config = CHAIN_CONFIGS[chainId];
  if (!config || !config.v4StateView) {
    throw new Error(`V4 not supported on chain: ${chainId}`);
  }

  const client = createPublicClient({
    chain: base,
    transport: http(config.rpc),
  });

  // Get current pool state from V4 StateView
  const [slot0, liquidity] = await Promise.all([
    client.readContract({
      address: config.v4StateView as `0x${string}`,
      abi: V4_STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [poolId as `0x${string}`],
    }) as Promise<[bigint, number, number, number]>,
    client.readContract({
      address: config.v4StateView as `0x${string}`,
      abi: V4_STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [poolId as `0x${string}`],
    }) as Promise<bigint>,
  ]);

  const currentTick = slot0[1];
  console.log(`[V4 TickLiquidity] Pool ${poolId.slice(0, 18)}... currentTick=${currentTick}, tickSpacing=${tickSpacing}`);

  // Get initialized ticks
  const initializedTicks = await getV4InitializedTicks(
    client,
    config.v4StateView,
    poolId,
    tickSpacing,
    currentTick,
    tickRange
  );
  console.log(`[V4 TickLiquidity] Found ${initializedTicks.length} initialized ticks`);

  // Query liquidity for each initialized tick
  const tickLiquidities: TickLiquidity[] = [];
  const batchSize = 20;

  for (let i = 0; i < initializedTicks.length; i += batchSize) {
    const batch = initializedTicks.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (tick) => {
        try {
          const tickData = await client.readContract({
            address: config.v4StateView as `0x${string}`,
            abi: V4_STATE_VIEW_ABI,
            functionName: 'getTickLiquidity',
            args: [poolId as `0x${string}`, tick],
          }) as [bigint, bigint];

          return {
            tick,
            liquidityGross: tickData[0].toString(),
            liquidityNet: tickData[1].toString(),
            price: tickToPrice(tick, token0Decimals, token1Decimals),
          };
        } catch {
          return null;
        }
      })
    );

    tickLiquidities.push(...results.filter((r): r is TickLiquidity => r !== null));
  }

  return {
    currentTick,
    ticks: tickLiquidities,
    totalLiquidity: liquidity.toString(),
  };
}

// Find large liquidity clusters (potential "big orders")
export function findLargeLiquidityClusters(
  ticks: TickLiquidity[],
  threshold: number = 2 // Multiplier above average to be considered "large"
): LiquidityCluster[] {
  if (ticks.length === 0) return [];

  // Calculate average liquidity
  const liquidities = ticks.map(t => BigInt(t.liquidityGross));
  const totalLiq = liquidities.reduce((sum, l) => sum + l, 0n);
  const avgLiq = totalLiq / BigInt(ticks.length);
  const thresholdLiq = avgLiq * BigInt(Math.floor(threshold));

  console.log(`[Clusters] Avg liquidity: ${avgLiq}, threshold: ${thresholdLiq}`);

  // Find ticks with above-threshold liquidity
  const largeTicks = ticks.filter(t => BigInt(t.liquidityGross) >= thresholdLiq);

  if (largeTicks.length === 0) return [];

  // Group adjacent large ticks into clusters
  const clusters: LiquidityCluster[] = [];
  let currentCluster: TickLiquidity[] = [largeTicks[0]];

  for (let i = 1; i < largeTicks.length; i++) {
    const prevTick = largeTicks[i - 1].tick;
    const currTick = largeTicks[i].tick;

    // If ticks are within 1000 of each other, group them
    if (currTick - prevTick <= 1000) {
      currentCluster.push(largeTicks[i]);
    } else {
      // Save current cluster and start new one
      if (currentCluster.length > 0) {
        const clusterLiq = currentCluster.reduce((sum, t) => sum + BigInt(t.liquidityGross), 0n);
        clusters.push({
          tickLower: currentCluster[0].tick,
          tickUpper: currentCluster[currentCluster.length - 1].tick,
          priceLower: currentCluster[0].price,
          priceUpper: currentCluster[currentCluster.length - 1].price,
          totalLiquidity: clusterLiq.toString(),
          tickCount: currentCluster.length,
          isLarge: true,
        });
      }
      currentCluster = [largeTicks[i]];
    }
  }

  // Don't forget the last cluster
  if (currentCluster.length > 0) {
    const clusterLiq = currentCluster.reduce((sum, t) => sum + BigInt(t.liquidityGross), 0n);
    clusters.push({
      tickLower: currentCluster[0].tick,
      tickUpper: currentCluster[currentCluster.length - 1].tick,
      priceLower: currentCluster[0].price,
      priceUpper: currentCluster[currentCluster.length - 1].price,
      totalLiquidity: clusterLiq.toString(),
      tickCount: currentCluster.length,
      isLarge: true,
    });
  }

  return clusters.sort((a, b) => {
    // Sort by liquidity descending
    const liqA = BigInt(a.totalLiquidity);
    const liqB = BigInt(b.totalLiquidity);
    if (liqB > liqA) return 1;
    if (liqB < liqA) return -1;
    return 0;
  });
}

// Main entry point: scan pool for large liquidity
export async function scanPoolLiquidity(
  chainId: string,
  poolAddress: string,
  token0Decimals: number = 18,
  token1Decimals: number = 18,
  tickRange: number = 5000,
  tickSpacing?: number
): Promise<{
  currentTick: number;
  currentPrice: number;
  ticks: TickLiquidity[];
  clusters: LiquidityCluster[];
  totalLiquidity: string;
}> {
  const isV4 = isV4Pool(poolAddress);

  let result;
  if (isV4) {
    result = await scanV4TickLiquidity(
      chainId,
      poolAddress,
      token0Decimals,
      token1Decimals,
      tickRange,
      tickSpacing || 200
    );
  } else {
    result = await scanV3TickLiquidity(
      chainId,
      poolAddress,
      token0Decimals,
      token1Decimals,
      tickRange
    );
  }

  const clusters = findLargeLiquidityClusters(result.ticks);

  return {
    ...result,
    currentPrice: tickToPrice(result.currentTick, token0Decimals, token1Decimals),
    clusters,
  };
}
