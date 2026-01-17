/**
 * Unified Liquidity Depth API - Supports V2, V3, and V4 pools
 *
 * Auto-detects pool type and returns consistent liquidity depth data.
 *
 * Query params:
 *   - chainId: Chain identifier (base, ethereum, etc.)
 *   - poolAddress: Pool address (V2/V3: 0x40chars, V4: 0x64chars)
 *   - priceUsd: Current price in USD (required for proper price calculation)
 *   - maxLevels: Max levels to return (0 = unlimited, default)
 *   - precision: Price precision for subdividing levels (optional)
 *   - token0Address: Token0 address (required for V4)
 *   - token1Address: Token1 address (required for V4)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, encodeFunctionData, decodeFunctionResult, formatUnits, type PublicClient, type Chain } from 'viem';
import { base, mainnet, bsc, arbitrum, polygon } from 'viem/chains';
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  isValidChainId,
  isValidPoolId,
  validatePositiveNumber,
  validatePositiveInteger,
  validationError,
} from '@/lib/api-validation';
import {
  getSolanaLiquidityDepth,
  generateFallbackDepth,
  detectSolanaDexType,
} from '@/lib/solana-liquidity';

// ============ Types ============

interface LiquidityLevel {
  price: number;
  priceUpper?: number;
  priceLower?: number;
  tickLower?: number;
  tickUpper?: number;
  token0Amount: number;
  token1Amount: number;
  liquidityUSD: number;
  liquidity?: string;
}

interface DepthData {
  bids: LiquidityLevel[];
  asks: LiquidityLevel[];
  currentPrice: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  poolType: 'v2' | 'v3' | 'v4';
}

// ============ Cache ============

interface CacheEntry {
  data: DepthData;
  timestamp: number;
}

const liquidityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2000; // 2 seconds - shorter for real-time updates

// ============ Chain Config ============

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://base-rpc.publicnode.com',
  bsc: 'https://bsc-dataseed1.binance.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  polygon: 'https://polygon-rpc.com',
};

const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
  arbitrum: arbitrum,
  polygon: polygon,
};

// V4 StateView addresses
const V4_STATE_VIEW: Record<string, string> = {
  ethereum: '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227',
  base: '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
  arbitrum: '0x76fd297e2D437cd7f76d50F01AfE6160f86e9990',
  polygon: '0x002D8C2Cf8a27D3044A9d5bD7e9d7146f8012c56',
  bsc: '0xd13Dd3D6E93f276FAf608fC159f2f5f3eAD4B19C',
};

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// ============ ABIs ============

const V3_POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function tickSpacing() view returns (int24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
  'function tickBitmap(int16 wordPosition) view returns (uint256)',
]);

const V2_POOL_ABI = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
]);

const V4_STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128)',
  'function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)',
  'function getTickBitmap(bytes32 poolId, int16 wordPos) view returns (uint256)',
]);

const ERC20_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

const MULTICALL3_ABI = [
  {
    inputs: [{ components: [{ name: 'target', type: 'address' }, { name: 'allowFailure', type: 'bool' }, { name: 'callData', type: 'bytes' }], name: 'calls', type: 'tuple[]' }],
    name: 'aggregate3',
    outputs: [{ components: [{ name: 'success', type: 'bool' }, { name: 'returnData', type: 'bytes' }], name: 'returnData', type: 'tuple[]' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============ Helpers ============

function isV4PoolId(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const price = Number(sqrtPriceX96) ** 2 / 2 ** 192;
  return price * 10 ** (decimals0 - decimals1);
}

function tickToPrice(tick: number, decimalAdjust: number): number {
  const safeTick = Math.max(-400000, Math.min(400000, tick));
  const price = decimalAdjust / Math.pow(1.0001, safeTick);
  if (!isFinite(price) || price > 1e18) return 1e18;
  if (price < 1e-18) return 1e-18;
  return price;
}

function priceToTick(price: number, decimalAdjust: number): number {
  if (price <= 0 || !isFinite(price) || decimalAdjust <= 0) return 0;
  return Math.round(Math.log(decimalAdjust / price) / Math.log(1.0001));
}

function calculateDecimalAdjust(price: number, tick: number): number {
  if (price <= 0 || !isFinite(price)) return 1e12;
  return price * Math.pow(1.0001, tick);
}

function getTickSpacing(lpFee: number): number {
  if (lpFee <= 100) return 1;
  if (lpFee <= 500) return 10;
  if (lpFee <= 3000) return 60;
  if (lpFee <= 10000) return 200;
  return 60;
}

// ============ Pool Type Detection ============

async function detectPoolType(
  client: PublicClient,
  poolAddress: string
): Promise<'v2' | 'v3' | 'v4' | 'unknown'> {
  if (isV4PoolId(poolAddress)) return 'v4';
  if (!isValidEvmAddress(poolAddress)) return 'unknown';

  // Try V3 (slot0)
  try {
    await client.readContract({
      address: poolAddress as `0x${string}`,
      abi: V3_POOL_ABI,
      functionName: 'slot0',
    });
    return 'v3';
  } catch {
    // Not V3
  }

  // Try V2 (getReserves)
  try {
    await client.readContract({
      address: poolAddress as `0x${string}`,
      abi: V2_POOL_ABI,
      functionName: 'getReserves',
    });
    return 'v2';
  } catch {
    // Not V2
  }

  return 'unknown';
}

// ============ V4 Depth Fetcher ============

async function getV4Depth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  chainId: string,
  poolId: string,
  priceUsd: number,
  maxLevels: number,
  precision: number,
  baseTokenAddress: string,
  quoteTokenAddress: string
): Promise<DepthData | null> {
  const stateViewAddr = V4_STATE_VIEW[chainId];
  if (!stateViewAddr) return null;

  // Fetch token info from chain if addresses provided
  let baseSymbol = 'TOKEN';
  let quoteSymbol = 'QUOTE';
  let baseDecimals = 18;
  let quoteDecimals = 18;

  if (baseTokenAddress && quoteTokenAddress) {
    try {
      const [baseDecimalsResult, quoteDecimalsResult, baseSymbolResult, quoteSymbolResult] = await Promise.all([
        client.readContract({ address: baseTokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
        client.readContract({ address: quoteTokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
        client.readContract({ address: baseTokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
        client.readContract({ address: quoteTokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
      ]);
      baseDecimals = Number(baseDecimalsResult);
      quoteDecimals = Number(quoteDecimalsResult);
      baseSymbol = baseSymbolResult as string;
      quoteSymbol = quoteSymbolResult as string;
      console.log(`[V4] Fetched token info: ${baseSymbol}(${baseDecimals}) / ${quoteSymbol}(${quoteDecimals})`);
    } catch (err) {
      console.error('[V4] Failed to fetch token info from chain:', err);
      // Continue with defaults
    }
  }

  // Get pool state
  const [slot0Result, liquidityResult] = await Promise.all([
    client.readContract({
      address: stateViewAddr as `0x${string}`,
      abi: V4_STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [poolId as `0x${string}`],
    }),
    client.readContract({
      address: stateViewAddr as `0x${string}`,
      abi: V4_STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [poolId as `0x${string}`],
    }),
  ]);

  const [, currentTick, , lpFee] = slot0Result as [bigint, number, number, number];
  const poolLiquidity = liquidityResult as bigint;
  const tickSpacing = getTickSpacing(lpFee);
  const decimalAdjust = priceUsd > 0 ? calculateDecimalAdjust(priceUsd, currentTick) : 1e12;

  // Query tick bitmap
  const MIN_TICK = -887200;
  const MAX_TICK = 887200;
  const minWord = Math.floor(MIN_TICK / tickSpacing / 256);
  const maxWord = Math.floor(MAX_TICK / tickSpacing / 256);

  const bitmapCalls = [];
  for (let wordPos = minWord; wordPos <= maxWord; wordPos++) {
    bitmapCalls.push({
      target: stateViewAddr as `0x${string}`,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: V4_STATE_VIEW_ABI,
        functionName: 'getTickBitmap',
        args: [poolId as `0x${string}`, wordPos],
      }),
    });
  }

  const bitmapResults = await client.readContract({
    address: MULTICALL3 as `0x${string}`,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [bitmapCalls],
  }) as Array<{ success: boolean; returnData: `0x${string}` }>;

  // Parse initialized ticks
  const initializedTicks: number[] = [];
  bitmapResults.forEach((res, wordIndex) => {
    if (res.success && res.returnData !== '0x' && res.returnData !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const wordPos = minWord + wordIndex;
      const bitmap = BigInt(res.returnData);
      for (let bit = 0; bit < 256; bit++) {
        if ((bitmap >> BigInt(bit)) & 1n) {
          const tick = (wordPos * 256 + bit) * tickSpacing;
          if (tick >= MIN_TICK && tick <= MAX_TICK) {
            initializedTicks.push(tick);
          }
        }
      }
    }
  });
  initializedTicks.sort((a, b) => a - b);

  // Query liquidityNet for each tick
  const tickLiquidityMap = new Map<number, { liquidityGross: bigint; liquidityNet: bigint }>();
  if (initializedTicks.length > 0) {
    const tickCalls = initializedTicks.map(tick => ({
      target: stateViewAddr as `0x${string}`,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: V4_STATE_VIEW_ABI,
        functionName: 'getTickLiquidity',
        args: [poolId as `0x${string}`, tick],
      }),
    }));

    const tickResults = await client.readContract({
      address: MULTICALL3 as `0x${string}`,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [tickCalls],
    }) as Array<{ success: boolean; returnData: `0x${string}` }>;

    tickResults.forEach((res, index) => {
      if (res.success && res.returnData !== '0x') {
        try {
          const decoded = decodeFunctionResult({
            abi: V4_STATE_VIEW_ABI,
            functionName: 'getTickLiquidity',
            data: res.returnData,
          }) as [bigint, bigint];
          tickLiquidityMap.set(initializedTicks[index], { liquidityGross: decoded[0], liquidityNet: decoded[1] });
        } catch { /* skip */ }
      }
    });
  }

  // Calculate token amounts using actual decimals
  // Quote token amount (what you pay with for bids)
  const calculateQuoteAmount = (liquidity: bigint, tickLower: number, tickUpper: number): number => {
    const L = Number(liquidity);
    if (L === 0) return 0;
    const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
    if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper) || sqrtPriceLower === 0 || sqrtPriceUpper === 0) return 0;
    const divisor = Math.pow(10, quoteDecimals);
    const amount = L * (1 / sqrtPriceLower - 1 / sqrtPriceUpper) / divisor;
    return isFinite(amount) && amount > 0 ? amount : 0;
  };

  // Base token amount (what you get for asks)
  const calculateBaseAmount = (liquidity: bigint, tickLower: number, tickUpper: number): number => {
    const L = Number(liquidity);
    if (L === 0) return 0;
    const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
    if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper)) return 0;
    const divisor = Math.pow(10, baseDecimals);
    const amount = L * (sqrtPriceUpper - sqrtPriceLower) / divisor;
    return isFinite(amount) && amount > 0 ? amount : 0;
  };

  // Build order book
  const bids: LiquidityLevel[] = [];
  const asks: LiquidityLevel[] = [];
  const allTicks = Array.from(tickLiquidityMap.keys()).sort((a, b) => a - b);
  const maxReasonableUsdc = 1e12;
  const maxReasonableAmount = (Number(poolLiquidity) / 1e18) * 10 * 1e6;

  // Subdivide helpers
  // For bids: user pays quote token to buy base token at lower prices
  const subdivideBidRange = (tickLower: number, tickUpper: number, liquidity: bigint, precisionStep: number): LiquidityLevel[] => {
    const levels: LiquidityLevel[] = [];
    const priceUpper = tickToPrice(tickLower, decimalAdjust);
    const priceLower = tickToPrice(tickUpper, decimalAdjust);

    if (precisionStep <= 0 || precisionStep >= priceUpper - priceLower) {
      const baseAmount = calculateBaseAmount(liquidity, tickLower, tickUpper);
      if (baseAmount > 0.01 && baseAmount < maxReasonableAmount) {
        levels.push({
          price: priceLower,
          priceLower,
          priceUpper,
          tickLower,
          tickUpper,
          token0Amount: baseAmount,
          token1Amount: 0,
          liquidityUSD: baseAmount * priceLower, // USD = base amount * price
          liquidity: liquidity.toString(),
        });
      }
      return levels;
    }

    let currentPriceHigh = Math.floor(priceUpper / precisionStep) * precisionStep;
    const minPrice = Math.max(priceLower, priceUpper * 0.01);
    const maxSubdivisions = 1000;

    while (currentPriceHigh > minPrice && levels.length < maxSubdivisions) {
      const currentPriceLow = Math.max(currentPriceHigh - precisionStep, priceLower);
      const subTickLower = priceToTick(currentPriceHigh, decimalAdjust);
      const subTickUpper = priceToTick(currentPriceLow, decimalAdjust);

      if (subTickUpper > subTickLower) {
        const baseAmount = calculateBaseAmount(liquidity, subTickLower, subTickUpper);
        if (baseAmount > 0.001 && baseAmount < maxReasonableAmount) {
          levels.push({
            price: currentPriceLow,
            priceLower: currentPriceLow,
            priceUpper: currentPriceHigh,
            tickLower: subTickLower,
            tickUpper: subTickUpper,
            token0Amount: baseAmount,
            token1Amount: 0,
            liquidityUSD: baseAmount * currentPriceLow, // USD = base amount * price
            liquidity: liquidity.toString(),
          });
        }
      }
      currentPriceHigh = currentPriceLow;
    }
    return levels;
  };

  // For asks: user sells base token to get quote token at higher prices
  const subdivideAskRange = (tickLower: number, tickUpper: number, liquidity: bigint, precisionStep: number): LiquidityLevel[] => {
    const levels: LiquidityLevel[] = [];
    const priceLower = tickToPrice(tickUpper, decimalAdjust);
    const priceUpper = tickToPrice(tickLower, decimalAdjust);

    if (precisionStep <= 0 || precisionStep >= priceUpper - priceLower) {
      const baseAmount = calculateBaseAmount(liquidity, tickLower, tickUpper);
      if (baseAmount > 0.01 && baseAmount < maxReasonableAmount) {
        levels.push({
          price: priceUpper,
          priceLower,
          priceUpper,
          tickLower,
          tickUpper,
          token0Amount: baseAmount,
          token1Amount: 0,
          liquidityUSD: baseAmount * priceUsd,
          liquidity: liquidity.toString(),
        });
      }
      return levels;
    }

    let currentPriceLow = Math.ceil(priceLower / precisionStep) * precisionStep;
    const maxPrice = Math.min(priceUpper, priceLower * 100);
    const maxSubdivisions = 1000;

    while (currentPriceLow < maxPrice && levels.length < maxSubdivisions) {
      const currentPriceHigh = Math.min(currentPriceLow + precisionStep, priceUpper);
      const subTickLower = priceToTick(currentPriceHigh, decimalAdjust);
      const subTickUpper = priceToTick(currentPriceLow, decimalAdjust);

      if (subTickUpper > subTickLower) {
        const baseAmount = calculateBaseAmount(liquidity, subTickLower, subTickUpper);
        if (baseAmount > 0.001 && baseAmount < maxReasonableAmount) {
          levels.push({
            price: currentPriceHigh,
            priceLower: currentPriceLow,
            priceUpper: currentPriceHigh,
            tickLower: subTickLower,
            tickUpper: subTickUpper,
            token0Amount: baseAmount,
            token1Amount: 0,
            liquidityUSD: baseAmount * priceUsd,
            liquidity: liquidity.toString(),
          });
        }
      }
      currentPriceLow = currentPriceHigh;
    }
    return levels;
  };

  // BIDS: price goes DOWN (tick goes UP)
  let bidLiquidity = poolLiquidity;
  const ticksForBids = allTicks.filter(t => t > currentTick).sort((a, b) => a - b);

  if (ticksForBids.length > 0 && bidLiquidity > 0n) {
    bids.push(...subdivideBidRange(currentTick, ticksForBids[0], bidLiquidity, precision));
  }

  for (let i = 0; i < ticksForBids.length - 1 && (maxLevels === 0 || bids.length < maxLevels); i++) {
    const tickData = tickLiquidityMap.get(ticksForBids[i]);
    if (tickData) bidLiquidity = bidLiquidity + tickData.liquidityNet;
    if (bidLiquidity <= 0n) continue;
    bids.push(...subdivideBidRange(ticksForBids[i], ticksForBids[i + 1], bidLiquidity, precision));
  }

  // ASKS: price goes UP (tick goes DOWN)
  let askLiquidity = poolLiquidity;
  const ticksForAsks = allTicks.filter(t => t < currentTick).sort((a, b) => b - a);

  if (ticksForAsks.length > 0 && askLiquidity > 0n) {
    asks.push(...subdivideAskRange(ticksForAsks[0], currentTick, askLiquidity, precision));
  }

  for (let i = 0; i < ticksForAsks.length - 1 && (maxLevels === 0 || asks.length < maxLevels); i++) {
    const tickData = tickLiquidityMap.get(ticksForAsks[i]);
    if (tickData) askLiquidity = askLiquidity - tickData.liquidityNet;
    if (askLiquidity <= 0n) continue;
    asks.push(...subdivideAskRange(ticksForAsks[i + 1], ticksForAsks[i], askLiquidity, precision));
  }

  // Sort and limit
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  const limitedBids = maxLevels > 0 ? bids.slice(0, maxLevels) : bids;
  const limitedAsks = maxLevels > 0 ? asks.slice(0, maxLevels) : asks;

  console.log(`[LiquidityDepth V4] ${limitedBids.length} bids, ${limitedAsks.length} asks for ${baseSymbol}/${quoteSymbol}`);

  return {
    bids: limitedBids,
    asks: limitedAsks,
    currentPrice: priceUsd,
    token0Symbol: baseSymbol,
    token1Symbol: quoteSymbol,
    token0Decimals: baseDecimals,
    token1Decimals: quoteDecimals,
    poolType: 'v4',
  };
}

// ============ V3 Depth Fetcher ============

async function getV3Depth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  poolAddress: string,
  priceUsd: number,
  maxLevels: number
): Promise<DepthData | null> {
  // Get pool data
  const [slot0, poolLiquidity, tickSpacingRaw, token0Addr, token1Addr] = await Promise.all([
    client.readContract({ address: poolAddress as `0x${string}`, abi: V3_POOL_ABI, functionName: 'slot0' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V3_POOL_ABI, functionName: 'liquidity' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V3_POOL_ABI, functionName: 'tickSpacing' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V3_POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V3_POOL_ABI, functionName: 'token1' }),
  ]);

  const [sqrtPriceX96, currentTick] = slot0 as unknown as [bigint, number, ...unknown[]];
  const tickSpacing = Number(tickSpacingRaw);

  // Get token info
  const [decimals0, decimals1, symbol0, symbol1] = await Promise.all([
    client.readContract({ address: token0Addr as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: token1Addr as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: token0Addr as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
    client.readContract({ address: token1Addr as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
  ]);

  const dec0 = Number(decimals0);
  const dec1 = Number(decimals1);

  // Determine base/quote
  const knownQuotePrices: Record<string, number> = { 'WETH': 3500, 'ETH': 3500, 'USDC': 1, 'USDT': 1, 'DAI': 1, 'WBNB': 600, 'BNB': 600 };
  const symbol0Upper = (symbol0 as string).toUpperCase();
  const symbol1Upper = (symbol1 as string).toUpperCase();
  const token0IsKnownQuote = symbol0Upper in knownQuotePrices;
  const token1IsKnownQuote = symbol1Upper in knownQuotePrices;

  let isToken0Base: boolean;
  if (token1IsKnownQuote && !token0IsKnownQuote) isToken0Base = true;
  else if (token0IsKnownQuote && !token1IsKnownQuote) isToken0Base = false;
  else isToken0Base = priceUsd < 1;

  const tickToPriceUsd = (tick: number): number => {
    const safeTick = Math.max(-887272, Math.min(887272, tick));
    const tickDiff = safeTick - currentTick;

    // For extreme tick differences, use a more conservative approach
    // Prevent Math.pow overflow by clamping the exponent
    const clampedDiff = Math.max(-100000, Math.min(100000, tickDiff));

    const price = priceUsd * Math.pow(1.0001, clampedDiff);

    // Return reasonable bounds instead of extreme values
    if (!isFinite(price)) return clampedDiff > 0 ? priceUsd * 1e6 : priceUsd / 1e6;
    if (price > priceUsd * 1e6) return priceUsd * 1e6; // Max 1 million times current price
    if (price < priceUsd / 1e6) return priceUsd / 1e6; // Min 1/1millionth of current price

    return price;
  };

  // Query tick bitmap
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;
  const minWord = Math.floor(MIN_TICK / tickSpacing / 256);
  const maxWord = Math.ceil(MAX_TICK / tickSpacing / 256);

  const bitmapCalls = [];
  for (let wordPos = minWord; wordPos <= maxWord; wordPos++) {
    bitmapCalls.push({
      target: poolAddress as `0x${string}`,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: V3_POOL_ABI,
        functionName: 'tickBitmap',
        args: [wordPos],
      }),
    });
  }

  const bitmapResults = await client.readContract({
    address: MULTICALL3 as `0x${string}`,
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3',
    args: [bitmapCalls],
  }) as Array<{ success: boolean; returnData: `0x${string}` }>;

  const initializedTicks: number[] = [];
  bitmapResults.forEach((res, wordIndex) => {
    if (res.success && res.returnData !== '0x' && res.returnData !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const wordPos = minWord + wordIndex;
      const bitmap = BigInt(res.returnData);
      for (let bit = 0; bit < 256; bit++) {
        if ((bitmap >> BigInt(bit)) & 1n) {
          const tick = (wordPos * 256 + bit) * tickSpacing;
          if (tick >= MIN_TICK && tick <= MAX_TICK) initializedTicks.push(tick);
        }
      }
    }
  });
  initializedTicks.sort((a, b) => a - b);

  // Query liquidityNet
  const tickLiquidityMap = new Map<number, bigint>();
  if (initializedTicks.length > 0) {
    const tickCalls = initializedTicks.map(tick => ({
      target: poolAddress as `0x${string}`,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: V3_POOL_ABI,
        functionName: 'ticks',
        args: [tick],
      }),
    }));

    const tickResults = await client.readContract({
      address: MULTICALL3 as `0x${string}`,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [tickCalls],
    }) as Array<{ success: boolean; returnData: `0x${string}` }>;

    tickResults.forEach((res, index) => {
      if (res.success && res.returnData !== '0x') {
        try {
          const decoded = decodeFunctionResult({
            abi: V3_POOL_ABI,
            functionName: 'ticks',
            data: res.returnData,
          }) as unknown as [bigint, bigint, ...unknown[]];
          tickLiquidityMap.set(initializedTicks[index], decoded[1]);
        } catch { /* skip */ }
      }
    });
  }

  // Calculate token amounts with safe math for extreme ticks
  const calculateToken0Amount = (L: bigint, tickLower: number, tickUpper: number): number => {
    // Clamp ticks to safe range to prevent Math.pow overflow
    const safeLower = Math.max(-887272, Math.min(887272, tickLower));
    const safeUpper = Math.max(-887272, Math.min(887272, tickUpper));

    const sqrtPriceLower = Math.pow(1.0001, safeLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, safeUpper / 2);

    if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper) || sqrtPriceLower === 0 || sqrtPriceUpper === 0) return 0;

    const amount = Number(L) * (1 / sqrtPriceLower - 1 / sqrtPriceUpper) / (10 ** dec0);

    // Validate result is reasonable (not overflow)
    if (!isFinite(amount) || amount <= 0 || amount > 1e15) return 0;
    return amount;
  };

  const calculateToken1Amount = (L: bigint, tickLower: number, tickUpper: number): number => {
    // Clamp ticks to safe range to prevent Math.pow overflow
    const safeLower = Math.max(-887272, Math.min(887272, tickLower));
    const safeUpper = Math.max(-887272, Math.min(887272, tickUpper));

    const sqrtPriceLower = Math.pow(1.0001, safeLower / 2);
    const sqrtPriceUpper = Math.pow(1.0001, safeUpper / 2);

    if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper)) return 0;

    const amount = Number(L) * (sqrtPriceUpper - sqrtPriceLower) / (10 ** dec1);

    // Validate result is reasonable (not overflow)
    if (!isFinite(amount) || amount <= 0 || amount > 1e15) return 0;
    return amount;
  };

  // Build order book
  const bids: LiquidityLevel[] = [];
  const asks: LiquidityLevel[] = [];
  const allTicks = Array.from(tickLiquidityMap.keys()).sort((a, b) => a - b);
  const ticksAbove = allTicks.filter(t => t > currentTick);
  const ticksBelow = allTicks.filter(t => t <= currentTick).reverse();

  const currentPriceRatio = sqrtPriceX96ToPrice(sqrtPriceX96, dec0, dec1);
  const quoteUsdPrice = isToken0Base ? (currentPriceRatio > 0 ? priceUsd / currentPriceRatio : 0) : priceUsd * currentPriceRatio;

  // ASKS
  let askLiquidity = poolLiquidity as bigint;
  let prevTickAbove = currentTick;

  for (const tick of ticksAbove) {
    if (maxLevels > 0 && asks.length >= maxLevels) break;
    const tickLower = prevTickAbove;
    const tickUpper = tick;

    // Log extreme tick ranges for debugging
    const tickRange = tickUpper - tickLower;
    if (tickRange > 50000) {
      console.log(`[V3 Extreme Range] ASK tick range: [${tickLower}, ${tickUpper}], Δ=${tickRange}`);
    }

    if (askLiquidity > 0n) {
      const priceL = tickToPriceUsd(tickUpper);
      let baseAmount: number, quoteAmount: number, liquidityUSD: number;

      if (isToken0Base) {
        baseAmount = calculateToken0Amount(askLiquidity, tickLower, tickUpper);
        quoteAmount = calculateToken1Amount(askLiquidity, tickLower, tickUpper);
        liquidityUSD = baseAmount * priceUsd;
      } else {
        baseAmount = calculateToken1Amount(askLiquidity, tickLower, tickUpper);
        quoteAmount = calculateToken0Amount(askLiquidity, tickLower, tickUpper);
        liquidityUSD = baseAmount * priceUsd;
      }

      // Skip entries with zero or invalid token amounts (from overflow protection)
      if (baseAmount === 0 && quoteAmount === 0) {
        console.log(`[V3 Skip] Tick range [${tickLower}, ${tickUpper}] resulted in zero amounts (likely overflow)`);
        askLiquidity = askLiquidity + (tickLiquidityMap.get(tick) || 0n);
        prevTickAbove = tick;
        continue;
      }

      if (liquidityUSD > 0.01 && liquidityUSD < 1e12) {
        asks.push({
          price: priceL,
          token0Amount: baseAmount,
          token1Amount: quoteAmount,
          liquidityUSD,
          tickLower,
          tickUpper,
        });
      }
    }

    askLiquidity = askLiquidity + (tickLiquidityMap.get(tick) || 0n);
    prevTickAbove = tick;
  }

  // BIDS
  let bidLiquidity = poolLiquidity as bigint;
  let prevTickBelow = currentTick;

  for (const tick of ticksBelow) {
    if (maxLevels > 0 && bids.length >= maxLevels) break;
    const tickUpper = prevTickBelow;
    const tickLower = tick;

    // Log extreme tick ranges for debugging
    const tickRange = tickUpper - tickLower;
    if (tickRange > 50000) {
      console.log(`[V3 Extreme Range] BID tick range: [${tickLower}, ${tickUpper}], Δ=${tickRange}`);
    }

    if (bidLiquidity > 0n) {
      const priceL = tickToPriceUsd(tickUpper);
      let baseAmount: number, quoteAmount: number, liquidityUSD: number;

      if (isToken0Base) {
        baseAmount = calculateToken0Amount(bidLiquidity, tickLower, tickUpper);
        quoteAmount = calculateToken1Amount(bidLiquidity, tickLower, tickUpper);
        liquidityUSD = quoteAmount * quoteUsdPrice;
      } else {
        baseAmount = calculateToken1Amount(bidLiquidity, tickLower, tickUpper);
        quoteAmount = calculateToken0Amount(bidLiquidity, tickLower, tickUpper);
        liquidityUSD = quoteAmount * quoteUsdPrice;
      }

      // Skip entries with zero or invalid token amounts (from overflow protection)
      if (baseAmount === 0 && quoteAmount === 0) {
        console.log(`[V3 Skip] Tick range [${tickLower}, ${tickUpper}] resulted in zero amounts (likely overflow)`);
        bidLiquidity = bidLiquidity - (tickLiquidityMap.get(tick) || 0n);
        prevTickBelow = tick;
        continue;
      }

      if (liquidityUSD > 0.01 && liquidityUSD < 1e12) {
        bids.push({
          price: priceL,
          token0Amount: baseAmount,
          token1Amount: quoteAmount,
          liquidityUSD,
          tickLower,
          tickUpper,
        });
      }
    }

    bidLiquidity = bidLiquidity - (tickLiquidityMap.get(tick) || 0n);
    prevTickBelow = tick;
  }

  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  const baseSymbol = isToken0Base ? symbol0 as string : symbol1 as string;
  const quoteSymbol = isToken0Base ? symbol1 as string : symbol0 as string;

  console.log(`[LiquidityDepth V3] ${bids.length} bids, ${asks.length} asks`);

  return {
    bids,
    asks,
    currentPrice: priceUsd > 0 ? priceUsd : 1,
    token0Symbol: baseSymbol,
    token1Symbol: quoteSymbol,
    token0Decimals: isToken0Base ? dec0 : dec1,
    token1Decimals: isToken0Base ? dec1 : dec0,
    poolType: 'v3',
  };
}

// ============ V2 Depth Fetcher ============

async function getV2Depth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  poolAddress: string,
  priceUsd: number,
  maxLevels: number
): Promise<DepthData | null> {
  const [token0Addr, token1Addr, reserves] = await Promise.all([
    client.readContract({ address: poolAddress as `0x${string}`, abi: V2_POOL_ABI, functionName: 'token0' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V2_POOL_ABI, functionName: 'token1' }),
    client.readContract({ address: poolAddress as `0x${string}`, abi: V2_POOL_ABI, functionName: 'getReserves' }),
  ]) as [`0x${string}`, `0x${string}`, readonly [bigint, bigint, number]];

  const [reserve0Raw, reserve1Raw] = reserves;

  const [decimals0, decimals1, symbol0, symbol1] = await Promise.all([
    client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'decimals' }),
    client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'symbol' }),
    client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'symbol' }),
  ]);

  const dec0 = Number(decimals0);
  const dec1 = Number(decimals1);
  const reserve0 = Number(formatUnits(reserve0Raw, dec0));
  const reserve1 = Number(formatUnits(reserve1Raw, dec1));

  // Determine base/quote
  const knownQuotePrices: Record<string, number> = { 'WETH': 3500, 'ETH': 3500, 'USDC': 1, 'USDT': 1, 'DAI': 1, 'BUSD': 1, 'WBNB': 600, 'BNB': 600 };
  const symbol0Upper = (symbol0 as string).toUpperCase();
  const symbol1Upper = (symbol1 as string).toUpperCase();
  const token0IsKnownQuote = symbol0Upper in knownQuotePrices;
  const token1IsKnownQuote = symbol1Upper in knownQuotePrices;

  let isToken0Base: boolean;
  if (token1IsKnownQuote && !token0IsKnownQuote) isToken0Base = true;
  else if (token0IsKnownQuote && !token1IsKnownQuote) isToken0Base = false;
  else isToken0Base = priceUsd < 1;

  const k = reserve0 * reserve1;
  const poolPrice = reserve1 / reserve0;

  const bids: LiquidityLevel[] = [];
  const asks: LiquidityLevel[] = [];
  const effectiveLevels = maxLevels > 0 ? Math.min(maxLevels, 50) : 50;
  const maxPct = 50;

  for (let i = 1; i <= effectiveLevels; i++) {
    const ratio = i / effectiveLevels;
    const pctChange = maxPct * Math.pow(ratio, 1.5);

    // BID
    const bidPriceRatio = 1 - pctChange / 100;
    if (bidPriceRatio > 0) {
      const newPoolPrice = poolPrice * bidPriceRatio;
      const newReserve0 = Math.sqrt(k / newPoolPrice);
      const newReserve1 = Math.sqrt(k * newPoolPrice);
      const token0Bought = newReserve0 - reserve0;
      const token1Spent = reserve1 - newReserve1;

      if (token0Bought > 0 && token1Spent > 0) {
        const bidPrice = priceUsd * bidPriceRatio;
        const liquidityUSD = isToken0Base ? token0Bought * bidPrice : token1Spent * priceUsd;
        bids.push({
          price: bidPrice,
          token0Amount: isToken0Base ? token0Bought : token1Spent,
          token1Amount: isToken0Base ? token1Spent : token0Bought,
          liquidityUSD: Math.abs(liquidityUSD),
        });
      }
    }

    // ASK
    const askPriceRatio = 1 + pctChange / 100;
    const newPoolPriceAsk = poolPrice * askPriceRatio;
    const newReserve0Ask = Math.sqrt(k / newPoolPriceAsk);
    const newReserve1Ask = Math.sqrt(k * newPoolPriceAsk);
    const token0Sold = reserve0 - newReserve0Ask;
    const token1Gained = newReserve1Ask - reserve1;

    if (token0Sold > 0 && token1Gained > 0) {
      const askPrice = priceUsd * askPriceRatio;
      const liquidityUSD = isToken0Base ? token0Sold * priceUsd : token1Gained * askPrice;
      asks.push({
        price: askPrice,
        token0Amount: isToken0Base ? token0Sold : token1Gained,
        token1Amount: isToken0Base ? token1Gained : token0Sold,
        liquidityUSD: Math.abs(liquidityUSD),
      });
    }
  }

  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  const baseSymbol = isToken0Base ? symbol0 as string : symbol1 as string;
  const quoteSymbol = isToken0Base ? symbol1 as string : symbol0 as string;

  console.log(`[LiquidityDepth V2] ${bids.length} bids, ${asks.length} asks`);

  return {
    bids,
    asks,
    currentPrice: priceUsd > 0 ? priceUsd : 1,
    token0Symbol: baseSymbol,
    token1Symbol: quoteSymbol,
    token0Decimals: isToken0Base ? dec0 : dec1,
    token1Decimals: isToken0Base ? dec1 : dec0,
    poolType: 'v2',
  };
}

// ============ Main Handler ============

export async function GET(request: NextRequest) {
  // Rate limiting
  const clientId = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = checkRateLimit(`liquidity-depth:${clientId}`, RATE_LIMITS.liquidity);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');

  // Validate required parameters
  if (!chainId || !poolAddress) {
    return validationError('Missing required parameters: chainId, poolAddress');
  }

  // Validate chainId
  if (!isValidChainId(chainId)) {
    return validationError(`Invalid chainId: ${chainId}. Must be one of: ethereum, base, bsc, solana`, 'chainId');
  }

  // Validate poolAddress format
  if (!isValidPoolId(poolAddress)) {
    return validationError('Invalid poolAddress format. Must be a valid Ethereum address or pool ID', 'poolAddress');
  }

  // Validate and parse priceUsd
  const priceUsdValidation = validatePositiveNumber(searchParams.get('priceUsd'), {
    min: 0,
    max: 1e15, // 1 quadrillion USD max
    defaultValue: 0,
  });
  if (!priceUsdValidation.valid) {
    return validationError(`Invalid priceUsd: ${priceUsdValidation.error}`, 'priceUsd');
  }
  const priceUsd = priceUsdValidation.value;

  // Validate and parse maxLevels
  const maxLevelsValidation = validatePositiveInteger(searchParams.get('maxLevels'), {
    min: 0,
    max: 1000, // Reasonable upper limit
    defaultValue: 0,
  });
  if (!maxLevelsValidation.valid) {
    return validationError(`Invalid maxLevels: ${maxLevelsValidation.error}`, 'maxLevels');
  }
  const maxLevels = maxLevelsValidation.value;

  // Validate and parse precision
  const precisionValidation = validatePositiveNumber(searchParams.get('precision'), {
    min: 0,
    max: 1,
    defaultValue: 0,
  });
  if (!precisionValidation.valid) {
    return validationError(`Invalid precision: ${precisionValidation.error}`, 'precision');
  }
  const precision = precisionValidation.value;

  // Additional params for Solana
  const dexId = searchParams.get('dexId') || '';
  const baseSymbol = searchParams.get('baseSymbol') || 'TOKEN';
  const quoteSymbol = searchParams.get('quoteSymbol') || 'SOL';
  const baseDecimals = parseInt(searchParams.get('baseDecimals') || '9');
  const quoteDecimals = parseInt(searchParams.get('quoteDecimals') || '9');
  const liquidityUsd = parseFloat(searchParams.get('liquidityUsd') || '0');
  const baseTokenAddress = searchParams.get('token0Address') || ''; // Used to match token order

  // Check cache (include dexId to prevent wrong poolType from cached results)
  const cacheKey = `${chainId}-${poolAddress}-${maxLevels}-${precision}-${dexId}`;
  const cached = liquidityCache.get(cacheKey);
  const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

  // Return fresh cache immediately
  if (cached && cacheAge < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: cached.data, source: 'cache' });
  }

  try {
    // Handle Solana separately
    if (chainId === 'solana') {
      console.log(`[LiquidityDepth] Solana pool: ${poolAddress.slice(0, 10)}..., DEX: ${dexId}`);

      // maxLevels=0 means no limit, use 150 for wide price coverage
      const effectiveMaxLevels = maxLevels > 0 ? maxLevels : 150;

      let result = await getSolanaLiquidityDepth(
        poolAddress,
        priceUsd,
        baseSymbol,
        quoteSymbol,
        baseDecimals,
        quoteDecimals,
        dexId,
        effectiveMaxLevels,
        baseTokenAddress,
        liquidityUsd // Pass DexScreener liquidity for better estimation
      );

      // If RPC fails, prefer stale cache over generated fallback
      if (!result) {
        // First try: use stale cache (up to 60 seconds old)
        if (cached && cacheAge < 60000) {
          console.log(`[LiquidityDepth] RPC failed, using stale cache (${Math.round(cacheAge / 1000)}s old)`);
          return NextResponse.json({ success: true, data: cached.data, source: 'stale-cache' });
        }

        // Second try: generate fallback from DexScreener liquidity
        if (liquidityUsd > 0) {
          console.log('[LiquidityDepth] RPC failed, no valid cache, using fallback');
          const dexType = detectSolanaDexType(dexId);
          result = generateFallbackDepth(
            priceUsd,
            liquidityUsd,
            baseSymbol,
            quoteSymbol,
            baseDecimals,
            quoteDecimals,
            effectiveMaxLevels,
            dexType
          );
        }
      }

      if (!result) {
        // Last resort: return very stale cache if available
        if (cached) {
          console.log(`[LiquidityDepth] All sources failed, using very stale cache (${Math.round(cacheAge / 1000)}s old)`);
          return NextResponse.json({ success: true, data: cached.data, source: 'stale-cache' });
        }
        return NextResponse.json({ error: 'Failed to fetch Solana liquidity data' }, { status: 500 });
      }

      // Cache result
      liquidityCache.set(cacheKey, { data: result as unknown as DepthData, timestamp: Date.now() });

      return NextResponse.json({ success: true, data: result, source: 'solana-rpc' });
    }

    // EVM chains
    const chain = CHAINS[chainId];
    const rpcUrl = RPC_URLS[chainId];

    if (!chain || !rpcUrl) {
      return NextResponse.json({ error: `Unsupported chain: ${chainId}` }, { status: 400 });
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 30000 }),
    });

    // Detect pool type
    const poolType = await detectPoolType(client, poolAddress);
    console.log(`[LiquidityDepth] Pool ${poolAddress.slice(0, 10)}... detected as ${poolType}`);

    let result: DepthData | null = null;

    switch (poolType) {
      case 'v4':
        result = await getV4Depth(client, chainId, poolAddress, priceUsd, maxLevels, precision, baseTokenAddress, searchParams.get('token1Address') || '');
        break;
      case 'v3':
        result = await getV3Depth(client, poolAddress, priceUsd, maxLevels);
        break;
      case 'v2':
        result = await getV2Depth(client, poolAddress, priceUsd, maxLevels);
        break;
      default:
        return NextResponse.json({ error: 'Unknown pool type' }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: 'Failed to fetch liquidity data' }, { status: 500 });
    }

    // Cache result
    liquidityCache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Cleanup old cache entries
    if (liquidityCache.size > 100) {
      const oldestKey = liquidityCache.keys().next().value;
      if (oldestKey) liquidityCache.delete(oldestKey);
    }

    return NextResponse.json({ success: true, data: result, source: 'rpc' });
  } catch (error) {
    console.error('[LiquidityDepth] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
