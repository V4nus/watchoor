/**
 * Order Flow API - Query REAL tick liquidity from on-chain data
 *
 * This API queries Uniswap V4 StateView contract to get:
 * 1. Current pool state (sqrtPriceX96, tick, liquidity, lpFee)
 * 2. Real tick liquidity data using multicall for efficiency
 * 3. Converts to order flow format (bids below current price, asks above)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, encodeFunctionData, decodeFunctionResult } from 'viem';
import { base } from 'viem/chains';

interface OrderFlowLevel {
  price: number;
  priceUpper: number;
  priceLower: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  liquidityUSD: number;
  tokenAmount: number;
}

// V4 StateView ABI
const V4_STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128)',
  'function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)',
  'function getTickBitmap(bytes32 poolId, int16 wordPos) view returns (uint256)',
]);

// Multicall3 ABI - use raw ABI format since parseAbi doesn't support complex tuples
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate3',
    outputs: [
      {
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
        name: 'returnData',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// V4 StateView address on Base
const V4_STATE_VIEW = '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71';
// Multicall3 address (same on all chains)
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Get tick spacing from lpFee (in hundredths of a bip)
function getTickSpacing(lpFee: number): number {
  // lpFee is in hundredths of a bip (1/100 of 0.01%)
  // Common fee tiers and their tick spacings:
  if (lpFee <= 100) return 1;      // 0.01% fee
  if (lpFee <= 500) return 10;     // 0.05% fee
  if (lpFee <= 3000) return 60;    // 0.30% fee
  if (lpFee <= 10000) return 200;  // 1.00% fee
  return 60; // Default
}

// Convert tick to price using dynamic decimal adjustment
// The decimalAdjust factor is calculated from known price and tick
function tickToPrice(tick: number, decimalAdjust: number): number {
  const safeTick = Math.max(-400000, Math.min(400000, tick));
  const price = decimalAdjust / Math.pow(1.0001, safeTick);
  if (!isFinite(price) || price > 1e18) return 1e18;
  if (price < 1e-18) return 1e-18;
  return price;
}

// Convert price to tick using dynamic decimal adjustment
function priceToTick(price: number, decimalAdjust: number): number {
  if (price <= 0 || !isFinite(price) || decimalAdjust <= 0) return 0;
  const tick = Math.log(decimalAdjust / price) / Math.log(1.0001);
  return Math.round(tick);
}

// Calculate decimal adjustment factor from known price and tick
// decimalAdjust = price * 1.0001^tick
function calculateDecimalAdjust(price: number, tick: number): number {
  if (price <= 0 || !isFinite(price)) return 1e12; // Default fallback
  const adjust = price * Math.pow(1.0001, tick);
  return adjust;
}

// Calculate USDC amount (token0) from liquidity for a tick range
function calculateUsdcAmount(liquidity: bigint, tickLower: number, tickUpper: number): number {
  const L = Number(liquidity);
  if (L === 0) return 0;

  const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
  const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);

  if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper) || sqrtPriceLower === 0 || sqrtPriceUpper === 0) {
    return 0;
  }

  const deltaInvSqrt = 1 / sqrtPriceLower - 1 / sqrtPriceUpper;
  if (!isFinite(deltaInvSqrt)) return 0;

  const amount = L * deltaInvSqrt / 1e6;
  return isFinite(amount) && amount > 0 ? amount : 0;
}

// Calculate PING amount (token1) from liquidity for a tick range
function calculatePingAmount(liquidity: bigint, tickLower: number, tickUpper: number): number {
  const L = Number(liquidity);
  if (L === 0) return 0;

  const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
  const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);

  if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper)) {
    return 0;
  }

  const deltaSqrt = sqrtPriceUpper - sqrtPriceLower;
  if (!isFinite(deltaSqrt)) return 0;

  const amount = L * deltaSqrt / 1e18;
  return isFinite(amount) && amount > 0 ? amount : 0;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');
  const priceUsdParam = searchParams.get('priceUsd');
  const maxLevels = parseInt(searchParams.get('maxLevels') || '50');
  const precision = parseFloat(searchParams.get('precision') || '0'); // Price precision for subdividing levels

  if (!chainId || !poolAddress) {
    return NextResponse.json(
      { error: 'Missing required parameters: chainId, poolAddress' },
      { status: 400 }
    );
  }

  // Only support V4 pools (64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(poolAddress)) {
    return NextResponse.json(
      { error: 'Only V4 pool IDs (64 hex chars) are supported' },
      { status: 400 }
    );
  }

  try {
    const client = createPublicClient({
      chain: base,
      transport: http('https://base-rpc.publicnode.com', { timeout: 30000 }),
    });

    // Step 1: Get pool state
    const [slot0Result, liquidityResult] = await Promise.all([
      client.readContract({
        address: V4_STATE_VIEW as `0x${string}`,
        abi: V4_STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolAddress as `0x${string}`],
      }),
      client.readContract({
        address: V4_STATE_VIEW as `0x${string}`,
        abi: V4_STATE_VIEW_ABI,
        functionName: 'getLiquidity',
        args: [poolAddress as `0x${string}`],
      }),
    ]);

    const [sqrtPriceX96, currentTick, , lpFee] = slot0Result as [bigint, number, number, number];
    const poolLiquidity = liquidityResult as bigint;
    const tickSpacing = getTickSpacing(lpFee);

    // Calculate decimal adjustment from user-provided price
    // This allows correct price calculation for any token pair regardless of decimals
    const priceUsd = parseFloat(priceUsdParam || '0');
    const decimalAdjust = priceUsd > 0 ? calculateDecimalAdjust(priceUsd, currentTick) : 1e12;
    const currentPrice = tickToPrice(currentTick, decimalAdjust);

    console.log(`[Order Flow] Pool: tick=${currentTick}, L=${poolLiquidity}, lpFee=${lpFee}, tickSpacing=${tickSpacing}, decimalAdjust=${decimalAdjust.toExponential(2)}`);

    // Step 2: Use TickBitmap to efficiently find initialized ticks
    // Instead of querying ~9000 ticks, we query ~36 bitmap words
    const MIN_TICK = -887200;
    const MAX_TICK = 887200;

    // Calculate word range for bitmap queries
    const minWord = Math.floor(MIN_TICK / tickSpacing / 256);
    const maxWord = Math.floor(MAX_TICK / tickSpacing / 256);

    console.log(`[Order Flow] Using TickBitmap: querying ${maxWord - minWord + 1} words (instead of ~9000 ticks)`);

    // Step 2a: Query all bitmap words using multicall
    const bitmapCalls = [];
    for (let wordPos = minWord; wordPos <= maxWord; wordPos++) {
      bitmapCalls.push({
        target: V4_STATE_VIEW as `0x${string}`,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: V4_STATE_VIEW_ABI,
          functionName: 'getTickBitmap',
          args: [poolAddress as `0x${string}`, wordPos],
        }),
      });
    }

    const bitmapResults = await client.readContract({
      address: MULTICALL3 as `0x${string}`,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [bitmapCalls],
    }) as Array<{ success: boolean; returnData: `0x${string}` }>;

    // Step 2b: Parse bitmaps to find initialized ticks
    const initializedTicks: number[] = [];
    bitmapResults.forEach((res, wordIndex) => {
      if (res.success && res.returnData !== '0x' && res.returnData !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        const wordPos = minWord + wordIndex;
        const bitmap = BigInt(res.returnData);

        // Check each bit in the 256-bit word
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
    console.log(`[Order Flow] Found ${initializedTicks.length} initialized ticks via bitmap: ${initializedTicks.join(', ')}`);

    // Step 2c: Query liquidityNet for each initialized tick
    const tickLiquidityMap = new Map<number, { liquidityGross: bigint; liquidityNet: bigint }>();

    if (initializedTicks.length > 0) {
      const tickCalls = initializedTicks.map(tick => ({
        target: V4_STATE_VIEW as `0x${string}`,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: V4_STATE_VIEW_ABI,
          functionName: 'getTickLiquidity',
          args: [poolAddress as `0x${string}`, tick],
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

            const [liquidityGross, liquidityNet] = decoded;
            tickLiquidityMap.set(initializedTicks[index], { liquidityGross, liquidityNet });
          } catch {
            // Skip invalid results
          }
        }
      });
    }

    // Get all initialized ticks sorted
    const allInitializedTicks = Array.from(tickLiquidityMap.keys()).sort((a, b) => a - b);
    const ticksAboveCurrent = allInitializedTicks.filter(t => t > currentTick);
    const ticksBelowCurrent = allInitializedTicks.filter(t => t < currentTick);
    console.log(`[Order Flow] Found ${allInitializedTicks.length} initialized ticks`);
    console.log(`[Order Flow] Ticks above current (${currentTick}): ${ticksAboveCurrent.join(', ') || 'none'}`);
    console.log(`[Order Flow] Ticks below current (${currentTick}): ${ticksBelowCurrent.join(', ') || 'none'}`);

    // Log liquidityNet for each tick to understand liquidity changes
    console.log(`[Order Flow] LiquidityNet at each tick:`);
    for (const tick of allInitializedTicks) {
      const data = tickLiquidityMap.get(tick);
      if (data) {
        console.log(`  tick ${tick}: liquidityNet = ${data.liquidityNet}`);
      }
    }

    // Step 6: Calculate order book from tick data
    // In V3/V4, liquidity between two initialized ticks is CONSTANT
    // We traverse from current tick, updating liquidity at each initialized tick
    //
    // IMPORTANT: In Uniswap, tick increases means token1 price goes UP
    // - BIDS (buy PING orders) = executed when price DROPS = tick goes DOWN
    // - ASKS (sell PING orders) = executed when price RISES = tick goes UP
    const bids: OrderFlowLevel[] = [];
    const asks: OrderFlowLevel[] = [];

    // Max reasonable USDC amount - filter out numerical overflow from extreme tick ranges
    const maxReasonableUsdc = 1e12;

    // Helper: subdivide a tick range into price-precision levels for BIDS
    const subdivideBidRange = (
      tickLower: number,
      tickUpper: number,
      liquidity: bigint,
      precisionStep: number
    ): OrderFlowLevel[] => {
      const levels: OrderFlowLevel[] = [];
      const priceUpper = tickToPrice(tickLower, decimalAdjust); // Higher price (lower tick)
      const priceLower = tickToPrice(tickUpper, decimalAdjust); // Lower price (higher tick)

      if (precisionStep <= 0 || precisionStep >= priceUpper - priceLower) {
        // No subdivision, return single level
        const usdcAmount = calculateUsdcAmount(liquidity, tickLower, tickUpper);
        if (usdcAmount > 0.01 && usdcAmount < maxReasonableUsdc) {
          levels.push({
            price: priceLower,
            priceLower,
            priceUpper,
            tickLower,
            tickUpper,
            liquidity: liquidity.toString(),
            liquidityUSD: usdcAmount,
            tokenAmount: usdcAmount,
          });
        }
        return levels;
      }

      // Subdivide by precision: from priceUpper down to priceLower
      let currentPriceHigh = Math.floor(priceUpper / precisionStep) * precisionStep;
      const minPrice = Math.max(priceLower, priceUpper * 0.01); // Don't go below 1% of upper price

      while (currentPriceHigh > minPrice && levels.length < maxLevels) {
        const currentPriceLow = Math.max(currentPriceHigh - precisionStep, priceLower);
        const subTickLower = priceToTick(currentPriceHigh, decimalAdjust);
        const subTickUpper = priceToTick(currentPriceLow, decimalAdjust);

        if (subTickUpper > subTickLower) {
          const usdcAmount = calculateUsdcAmount(liquidity, subTickLower, subTickUpper);
          if (usdcAmount > 0.001 && usdcAmount < maxReasonableUsdc) {
            levels.push({
              price: currentPriceLow,
              priceLower: currentPriceLow,
              priceUpper: currentPriceHigh,
              tickLower: subTickLower,
              tickUpper: subTickUpper,
              liquidity: liquidity.toString(),
              liquidityUSD: usdcAmount,
              tokenAmount: usdcAmount,
            });
          }
        }
        currentPriceHigh = currentPriceLow;
      }
      return levels;
    };

    // BIDS: price goes DOWN (tick goes UP from current)
    let bidLiquidity = poolLiquidity;
    const ticksForBids = allInitializedTicks.filter(t => t > currentTick).sort((a, b) => a - b);

    console.log(`[Order Flow] BID calculation with precision=${precision}, starting L=${bidLiquidity}`);
    console.log(`[Order Flow] Ticks for bids (above ${currentTick}): ${ticksForBids.join(', ') || 'none'}`);

    // First interval: from current tick UP to first initialized tick above
    if (ticksForBids.length > 0 && bidLiquidity > 0n) {
      const firstBidTick = ticksForBids[0];
      const subLevels = subdivideBidRange(currentTick, firstBidTick, bidLiquidity, precision);
      bids.push(...subLevels);
      console.log(`[Order Flow] BID interval ${currentTick} -> ${firstBidTick}: ${subLevels.length} levels`);
    }

    // Subsequent bid intervals
    for (let i = 0; i < ticksForBids.length - 1 && bids.length < maxLevels; i++) {
      const tickLower = ticksForBids[i];
      const tickUpper = ticksForBids[i + 1];

      const tickData = tickLiquidityMap.get(tickLower);
      if (tickData) {
        bidLiquidity = bidLiquidity + tickData.liquidityNet;
      }

      if (bidLiquidity <= 0n) continue;

      const subLevels = subdivideBidRange(tickLower, tickUpper, bidLiquidity, precision);
      bids.push(...subLevels);
    }

    // Helper: subdivide a tick range into price-precision levels for ASKS
    const subdivideAskRange = (
      tickLower: number,
      tickUpper: number,
      liquidity: bigint,
      precisionStep: number,
      currentPriceUsd: number
    ): OrderFlowLevel[] => {
      const levels: OrderFlowLevel[] = [];
      const priceLower = tickToPrice(tickUpper, decimalAdjust); // Lower price (higher tick)
      const priceUpper = tickToPrice(tickLower, decimalAdjust); // Higher price (lower tick)

      // Max reasonable token amount
      const maxReasonableAmount = (Number(poolLiquidity) / 1e18) * 10 * 1e6;

      if (precisionStep <= 0 || precisionStep >= priceUpper - priceLower) {
        // No subdivision, return single level
        const tokenAmount = calculatePingAmount(liquidity, tickLower, tickUpper);
        if (tokenAmount > 0.01 && tokenAmount < maxReasonableAmount) {
          levels.push({
            price: priceUpper,
            priceLower,
            priceUpper,
            tickLower,
            tickUpper,
            liquidity: liquidity.toString(),
            liquidityUSD: tokenAmount * currentPriceUsd,
            tokenAmount: tokenAmount,
          });
        }
        return levels;
      }

      // Subdivide by precision: from priceLower up to priceUpper
      let currentPriceLow = Math.ceil(priceLower / precisionStep) * precisionStep;
      const maxPrice = Math.min(priceUpper, priceLower * 100); // Don't go above 100x lower price

      while (currentPriceLow < maxPrice && levels.length < maxLevels) {
        const currentPriceHigh = Math.min(currentPriceLow + precisionStep, priceUpper);
        const subTickLower = priceToTick(currentPriceHigh, decimalAdjust);
        const subTickUpper = priceToTick(currentPriceLow, decimalAdjust);

        if (subTickUpper > subTickLower) {
          const pingAmount = calculatePingAmount(liquidity, subTickLower, subTickUpper);
          if (pingAmount > 0.001 && pingAmount < maxReasonableAmount) {
            levels.push({
              price: currentPriceHigh,
              priceLower: currentPriceLow,
              priceUpper: currentPriceHigh,
              tickLower: subTickLower,
              tickUpper: subTickUpper,
              liquidity: liquidity.toString(),
              liquidityUSD: pingAmount * currentPriceUsd,
              tokenAmount: pingAmount,
            });
          }
        }
        currentPriceLow = currentPriceHigh;
      }
      return levels;
    };

    // ASKS: price goes UP (tick goes DOWN from current)
    // In Uniswap, lower tick = higher price (price = 10^12 / 1.0001^tick)
    // These represent PING that will be sold when price rises
    // Traverse from current tick DOWNWARD
    let askLiquidity = poolLiquidity;
    const ticksForAsks = allInitializedTicks.filter(t => t < currentTick).sort((a, b) => b - a); // Sort descending (traverse down)

    console.log(`[Order Flow] ASK calculation with precision=${precision}, starting L=${askLiquidity}`);
    console.log(`[Order Flow] Ticks for asks (below ${currentTick}): ${ticksForAsks.join(', ') || 'none'}`);

    // First interval: from current tick DOWN to first initialized tick below
    if (ticksForAsks.length > 0 && askLiquidity > 0n) {
      const firstAskTick = ticksForAsks[0];
      const subLevels = subdivideAskRange(firstAskTick, currentTick, askLiquidity, precision, priceUsd);
      asks.push(...subLevels);
      console.log(`[Order Flow] ASK interval ${currentTick} -> ${firstAskTick}: ${subLevels.length} levels`);
    }

    // Subsequent ask intervals (continue going DOWN)
    for (let i = 0; i < ticksForAsks.length - 1 && asks.length < maxLevels; i++) {
      const tickUpper = ticksForAsks[i];    // Higher tick
      const tickLower = ticksForAsks[i + 1]; // Lower tick

      // When going DOWN (decreasing tick), subtract liquidityNet at the tick we're crossing
      const tickData = tickLiquidityMap.get(tickUpper);
      if (tickData) {
        askLiquidity = askLiquidity - tickData.liquidityNet;
      }

      if (askLiquidity <= 0n) continue;

      const subLevels = subdivideAskRange(tickLower, tickUpper, askLiquidity, precision, priceUsd);
      asks.push(...subLevels);
    }

    // Sort: bids by price descending, asks by price ascending
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    // Limit results
    const limitedBids = bids.slice(0, maxLevels);
    const limitedAsks = asks.slice(0, maxLevels);

    // Calculate totals
    const totalBidUSD = limitedBids.reduce((sum, b) => sum + b.liquidityUSD, 0);
    const totalAskUSD = limitedAsks.reduce((sum, a) => sum + a.liquidityUSD, 0);
    const totalBidUsdc = limitedBids.reduce((sum, b) => sum + b.tokenAmount, 0);
    const totalAskPing = limitedAsks.reduce((sum, a) => sum + a.tokenAmount, 0);

    // Calculate pool reserves from sqrtPriceX96 and liquidity
    const sqrtPriceFloat = Number(sqrtPriceX96) / (2 ** 96);
    const L_float = Number(poolLiquidity);
    const token0Reserve = sqrtPriceFloat > 0 ? (L_float / sqrtPriceFloat) / 1e6 : 0;
    const token1Reserve = (L_float * sqrtPriceFloat) / 1e18;

    console.log(`[Order Flow] Result: ${limitedBids.length} bids (${totalBidUsdc.toFixed(2)} USDC), ${limitedAsks.length} asks (${totalAskPing.toFixed(2)} PING)`);

    return NextResponse.json({
      success: true,
      data: {
        bids: limitedBids,
        asks: limitedAsks,
        currentPrice,
        currentTick,
        tickSpacing,
        poolLiquidity: poolLiquidity.toString(),
        initializedTicks: tickLiquidityMap.size,
        totalBidUSD,
        totalAskUSD,
        totalBidUsdc,
        totalAskPing,
        poolReserves: {
          token0: token0Reserve,
          token1: token1Reserve,
          token0Symbol: 'USDC',
          token1Symbol: 'PING',
        },
        source: 'real_tick_data',
      },
    });
  } catch (error) {
    console.error('[Order Flow] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
