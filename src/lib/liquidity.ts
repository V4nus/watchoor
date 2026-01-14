import { createPublicClient, http, formatUnits, parseAbi, encodeFunctionData, decodeFunctionResult } from 'viem';
import { base, mainnet, bsc, arbitrum, polygon } from 'viem/chains';

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const tokenInfoCache = new Map<string, CacheEntry<{ decimals: number; symbol: string }>>();
const liquidityCache = new Map<string, CacheEntry<DepthData>>();
const TOKEN_CACHE_TTL = 3600000; // 1 hour for token info (rarely changes)
const LIQUIDITY_CACHE_TTL = 60000; // 60 seconds for liquidity data (increased to reduce RPC calls)

function getCachedTokenInfo(key: string) {
  const entry = tokenInfoCache.get(key);
  if (entry && Date.now() - entry.timestamp < TOKEN_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedTokenInfo(key: string, data: { decimals: number; symbol: string }) {
  tokenInfoCache.set(key, { data, timestamp: Date.now() });
}

function getCachedLiquidity(key: string) {
  const entry = liquidityCache.get(key);
  if (entry && Date.now() - entry.timestamp < LIQUIDITY_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedLiquidity(key: string, data: DepthData) {
  liquidityCache.set(key, { data, timestamp: Date.now() });
}

// RPC endpoints - multiple fallbacks for each chain
const RPC_URLS: Record<string, string[]> = {
  ethereum: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
  ],
  base: [
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org',
    'https://rpc.ankr.com/base',
  ],
  bsc: [
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://rpc.ankr.com/bsc',
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
  ],
};

// Track which RPC index to use (rotate on failure)
const rpcIndexes: Record<string, number> = {};

function getRpcUrl(chainId: string): string {
  const urls = RPC_URLS[chainId];
  if (!urls || urls.length === 0) return '';
  const index = rpcIndexes[chainId] || 0;
  return urls[index % urls.length];
}

function rotateRpc(chainId: string): void {
  const urls = RPC_URLS[chainId];
  if (!urls) return;
  rpcIndexes[chainId] = ((rpcIndexes[chainId] || 0) + 1) % urls.length;
  console.log(`Rotated RPC for ${chainId} to index ${rpcIndexes[chainId]}: ${urls[rpcIndexes[chainId]]}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAINS: Record<string, any> = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
  arbitrum: arbitrum,
  polygon: polygon,
};

// Uniswap V3 Pool ABI (minimal)
const V3_POOL_ABI = parseAbi([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)',
  'function tickSpacing() view returns (int24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)',
  'function tickBitmap(int16 wordPosition) view returns (uint256)',
]);

// Multicall3 ABI for efficient batch calls
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

// Multicall3 address (same on all EVM chains)
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// Uniswap V4 PoolManager ABI (minimal for state queries)
const V4_POOL_MANAGER_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128)',
  'function getTickInfo(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)',
  'function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)',
]);

// Uniswap V4 StateView ABI (for reading pool state)
const V4_STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) view returns (uint128)',
  'function getTickLiquidity(bytes32 poolId, int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet)',
]);

// V4 PoolManager addresses per chain (deployed Jan 2025)
const V4_POOL_MANAGER: Record<string, string> = {
  ethereum: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  base: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  arbitrum: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
  polygon: '0x67366782805870060151383F4BbFF9daB53e5cD6',
  bsc: '0x28e2Ea090877bF75740558f6BFB36A5ffeE9e9dF',
};

// V4 StateView addresses per chain
const V4_STATE_VIEW: Record<string, string> = {
  ethereum: '0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227',
  base: '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
  arbitrum: '0x76fd297e2D437cd7f76d50F01AfE6160f86e9990',
  polygon: '0x002D8C2Cf8a27D3044A9d5bD7e9d7146f8012c56',
  bsc: '0xd13Dd3D6E93f276FAf608fC159f2f5f3eAD4B19C',
};

// V4 ModifyLiquidity event signature
const V4_MODIFY_LIQUIDITY_TOPIC = '0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec';

// Cache for LP positions
const lpPositionsCache = new Map<string, CacheEntry<LPPosition[]>>();
const LP_CACHE_TTL = 120000; // 2 minutes for LP positions

function getCachedLPPositions(key: string) {
  const entry = lpPositionsCache.get(key);
  if (entry && Date.now() - entry.timestamp < LP_CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCachedLPPositions(key: string, data: LPPosition[]) {
  lpPositionsCache.set(key, { data, timestamp: Date.now() });
}

// ERC20 ABI for decimals
const ERC20_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
]);

export interface LiquidityLevel {
  price: number;
  token0Amount: number;
  token1Amount: number;
  liquidityUSD: number;
  tickLower?: number;
  tickUpper?: number;
}

export interface DepthData {
  bids: LiquidityLevel[]; // Below current price (buy side)
  asks: LiquidityLevel[]; // Above current price (sell side)
  currentPrice: number;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
}

export interface LPPosition {
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  liquidityDelta: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: 'add' | 'remove';
  priceLower: number;
  priceUpper: number;
}

// Convert sqrtPriceX96 to actual price
function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const price = Number(sqrtPriceX96) ** 2 / 2 ** 192;
  return price * 10 ** (decimals0 - decimals1);
}

// Convert tick to price
function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return 1.0001 ** tick * 10 ** (decimals0 - decimals1);
}

// Calculate tokens from liquidity and price range
function getTokenAmounts(
  liquidity: bigint,
  sqrtPriceLower: number,
  sqrtPriceUpper: number,
  sqrtPriceCurrent: number
): { amount0: number; amount1: number } {
  let amount0 = 0;
  let amount1 = 0;

  if (sqrtPriceCurrent <= sqrtPriceLower) {
    // Current price below range - all token0
    amount0 = Number(liquidity) * (1 / sqrtPriceLower - 1 / sqrtPriceUpper);
  } else if (sqrtPriceCurrent >= sqrtPriceUpper) {
    // Current price above range - all token1
    amount1 = Number(liquidity) * (sqrtPriceUpper - sqrtPriceLower);
  } else {
    // Current price in range - both tokens
    amount0 = Number(liquidity) * (1 / sqrtPriceCurrent - 1 / sqrtPriceUpper);
    amount1 = Number(liquidity) * (sqrtPriceCurrent - sqrtPriceLower);
  }

  return { amount0, amount1 };
}

// Validate EVM address (20 bytes = 40 hex chars + 0x prefix)
function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Check if it's a V4 pool ID (32 bytes = 64 hex chars + 0x prefix)
function isV4PoolId(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

// Decode int24 from hex string (handles signed values)
function decodeInt24(hex: string): number {
  const value = parseInt(hex, 16);
  // If the highest bit is set, it's negative
  if (value >= 0x800000) {
    return value - 0x1000000;
  }
  return value;
}

// Decode int256 from hex string (handles signed values)
function decodeInt256(hex: string): bigint {
  const value = BigInt('0x' + hex);
  // If highest bit is set (first char >= 8), it's negative
  const firstChar = hex[0];
  if (firstChar >= '8') {
    // Two's complement for 256 bits
    return value - BigInt('0x' + 'f'.repeat(64)) - 1n;
  }
  return value;
}

// Get V4 LP position history from ModifyLiquidity events
export async function getV4LPPositions(
  chainId: string,
  poolId: string,
  token0Address: string,
  token1Address: string,
  fromBlock?: number,
  limit: number = 100
): Promise<LPPosition[]> {
  try {
    // Check cache first
    const cacheKey = `v4lp:${chainId}:${poolId}:${limit}`;
    const cached = getCachedLPPositions(cacheKey);
    if (cached) {
      console.log('V4 LP positions cache hit');
      return cached;
    }

    const chain = CHAINS[chainId];
    const rpcUrl = getRpcUrl(chainId);
    const poolManagerAddr = V4_POOL_MANAGER[chainId];

    if (!chain || !rpcUrl || !poolManagerAddr) {
      console.error('V4 not supported on chain:', chainId);
      return [];
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 30000 }), // 30 second timeout for logs
    });

    // Get current block number
    const currentBlock = await client.getBlockNumber();

    // Query from last 50000 blocks (roughly 1-2 days depending on chain)
    // This balances data freshness with RPC load
    const blocksToQuery = 50000n;
    const startBlock = fromBlock
      ? BigInt(fromBlock)
      : currentBlock - blocksToQuery;

    console.log(`Fetching V4 LP events for pool ${poolId.slice(0, 10)}... from block ${startBlock}`);

    // Get token decimals for price calculation
    let decimals0 = 18, decimals1 = 18;
    try {
      const addr0Lower = token0Address.toLowerCase();
      const addr1Lower = token1Address.toLowerCase();
      const actualToken0 = addr0Lower < addr1Lower ? token0Address : token1Address;
      const actualToken1 = addr0Lower < addr1Lower ? token1Address : token0Address;

      const token0CacheKey = `${chainId}:${actualToken0.toLowerCase()}`;
      const token1CacheKey = `${chainId}:${actualToken1.toLowerCase()}`;
      const cachedToken0 = getCachedTokenInfo(token0CacheKey);
      const cachedToken1 = getCachedTokenInfo(token1CacheKey);

      if (cachedToken0 && cachedToken1) {
        decimals0 = cachedToken0.decimals;
        decimals1 = cachedToken1.decimals;
      } else {
        const [d0, d1] = await Promise.all([
          client.readContract({ address: actualToken0 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
          client.readContract({ address: actualToken1 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
        ]);
        decimals0 = Number(d0);
        decimals1 = Number(d1);
      }
    } catch (e) {
      console.warn('Failed to get token decimals, using default 18:', e);
    }

    // Fetch ModifyLiquidity events
    const logs = await client.getLogs({
      address: poolManagerAddr as `0x${string}`,
      event: {
        type: 'event',
        name: 'ModifyLiquidity',
        inputs: [
          { type: 'bytes32', name: 'id', indexed: true },
          { type: 'address', name: 'sender', indexed: true },
          { type: 'int24', name: 'tickLower', indexed: false },
          { type: 'int24', name: 'tickUpper', indexed: false },
          { type: 'int256', name: 'liquidityDelta', indexed: false },
          { type: 'bytes32', name: 'salt', indexed: false },
        ],
      },
      args: {
        id: poolId as `0x${string}`,
      },
      fromBlock: startBlock,
      toBlock: currentBlock,
    });

    console.log(`Found ${logs.length} V4 LP events`);

    // Get block timestamps in batches
    const uniqueBlocks = [...new Set(logs.map(log => log.blockNumber))];
    const blockTimestamps = new Map<bigint, number>();

    // Fetch timestamps in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < uniqueBlocks.length; i += batchSize) {
      const batch = uniqueBlocks.slice(i, i + batchSize);
      const blocks = await Promise.all(
        batch.map(blockNum => client.getBlock({ blockNumber: blockNum }))
      );
      blocks.forEach((block, idx) => {
        blockTimestamps.set(batch[idx], Number(block.timestamp));
      });
    }

    // Parse events into LPPosition format
    const positions: LPPosition[] = logs.map(log => {
      const args = log.args as {
        id: `0x${string}`;
        sender: `0x${string}`;
        tickLower: number;
        tickUpper: number;
        liquidityDelta: bigint;
        salt: `0x${string}`;
      };

      const liquidityDelta = args.liquidityDelta;
      const isAdd = liquidityDelta > 0n;
      const absLiquidity = isAdd ? liquidityDelta : -liquidityDelta;

      // Calculate prices from ticks
      const priceLower = tickToPrice(args.tickLower, decimals0, decimals1);
      const priceUpper = tickToPrice(args.tickUpper, decimals0, decimals1);

      return {
        owner: args.sender,
        tickLower: args.tickLower,
        tickUpper: args.tickUpper,
        liquidity: absLiquidity.toString(),
        liquidityDelta: liquidityDelta.toString(),
        txHash: log.transactionHash,
        blockNumber: Number(log.blockNumber),
        timestamp: blockTimestamps.get(log.blockNumber) || 0,
        type: isAdd ? 'add' : 'remove',
        priceLower,
        priceUpper,
      };
    });

    // Sort by block number descending (newest first) and limit
    const sortedPositions = positions
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, limit);

    // Cache the result
    setCachedLPPositions(cacheKey, sortedPositions);

    return sortedPositions;
  } catch (error) {
    console.error('Error fetching V4 LP positions:', error);
    // On RPC error, try rotating to next RPC
    rotateRpc(chainId);
    return [];
  }
}

// Get V4 liquidity depth using StateView contract
export async function getV4LiquidityDepth(
  chainId: string,
  poolId: string,
  priceUsd: number,
  token0Address: string,
  token1Address: string,
  levels: number = 50 // Query more ticks for better coverage
): Promise<DepthData | null> {
  try {
    // Check cache first
    const cacheKey = `v4:${chainId}:${poolId}:${levels}:${Math.round(priceUsd * 10000)}`;
    const cached = getCachedLiquidity(cacheKey);
    if (cached) {
      console.log('V4 depth cache hit');
      return cached;
    }

    const chain = CHAINS[chainId];
    const rpcUrl = getRpcUrl(chainId);
    const stateViewAddr = V4_STATE_VIEW[chainId];

    if (!chain || !rpcUrl || !stateViewAddr) {
      console.error('V4 not supported on chain:', chainId);
      return null;
    }

    if (!isV4PoolId(poolId)) {
      console.error('Invalid V4 pool ID format:', poolId);
      return null;
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 10000 }), // 10 second timeout
    });

    // Get pool state from StateView
    let slot0Result: unknown;
    let liquidity: unknown;

    try {
      [slot0Result, liquidity] = await Promise.all([
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
    } catch (e) {
      console.error('V4 pool state fetch failed:', e);
      return null;
    }

    const [sqrtPriceX96] = slot0Result as unknown as [bigint, number, number, number];

    // In Uniswap V3/V4, token0 is always the token with the lower address
    // DexScreener passes baseToken and quoteToken which may be in different order
    const addr0Lower = token0Address.toLowerCase();
    const addr1Lower = token1Address.toLowerCase();
    const isToken0Base = addr0Lower < addr1Lower;

    // Get token info - use correct order based on address sorting
    let decimals0: number, decimals1: number, symbol0: string, symbol1: string;
    const actualToken0 = isToken0Base ? token0Address : token1Address;
    const actualToken1 = isToken0Base ? token1Address : token0Address;

    // Check token cache first
    const token0CacheKey = `${chainId}:${actualToken0.toLowerCase()}`;
    const token1CacheKey = `${chainId}:${actualToken1.toLowerCase()}`;
    const cachedToken0 = getCachedTokenInfo(token0CacheKey);
    const cachedToken1 = getCachedTokenInfo(token1CacheKey);

    if (cachedToken0 && cachedToken1) {
      decimals0 = cachedToken0.decimals;
      symbol0 = cachedToken0.symbol;
      decimals1 = cachedToken1.decimals;
      symbol1 = cachedToken1.symbol;
    } else {
      try {
        const tokenInfo = await Promise.all([
          client.readContract({ address: actualToken0 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
          client.readContract({ address: actualToken1 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }),
          client.readContract({ address: actualToken0 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
          client.readContract({ address: actualToken1 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }),
        ]);
        decimals0 = Number(tokenInfo[0]);
        decimals1 = Number(tokenInfo[1]);
        symbol0 = tokenInfo[2] as string;
        symbol1 = tokenInfo[3] as string;

        // Cache token info
        setCachedTokenInfo(token0CacheKey, { decimals: decimals0, symbol: symbol0 });
        setCachedTokenInfo(token1CacheKey, { decimals: decimals1, symbol: symbol1 });
      } catch (e) {
        console.error('Token info fetch failed:', e);
        return null;
      }
    }

    // Calculate price - sqrtPriceX96ToPrice gives price of token1 in terms of token0
    let currentPrice = sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);

    // If base token is token1 (higher address), we need to invert to get base/quote price
    if (!isToken0Base) {
      currentPrice = 1 / currentPrice;
      // Swap symbols for display
      [symbol0, symbol1] = [symbol1, symbol0];
      [decimals0, decimals1] = [decimals1, decimals0];
    }


    // Use pool liquidity to estimate depth at various price levels
    const bids: LiquidityLevel[] = [];
    const asks: LiquidityLevel[] = [];

    const L = Number(liquidity as bigint);
    const displayPrice = priceUsd > 0 ? priceUsd : currentPrice;
    const sqrtP = Math.sqrt(displayPrice);
    const decimalFactor = 10 ** ((decimals0 + decimals1) / 2);

    // Generate exactly 50 levels scaled to the selected range
    // levels parameter = max percentage (50 or 100)
    const maxPct = levels;
    const pricePctSteps: number[] = [];

    // Generate 50 levels evenly distributed across the range
    // More density near current price, less at extremes
    for (let i = 1; i <= 50; i++) {
      // Non-linear distribution: more granular near 0%, less granular near maxPct
      // Using square root scaling for better distribution
      const ratio = i / 50;
      const pct = maxPct * Math.pow(ratio, 1.5); // Power curve for non-linear distribution
      pricePctSteps.push(pct);
    }

    // Helper function to calculate tick from USDC per PING price
    // price = 10^12 / 1.0001^tick, so tick = log(10^12 / price) / log(1.0001)
    const priceToTick = (usdcPerPing: number): number => {
      if (usdcPerPing <= 0) return -887272; // MIN_TICK
      const tick = Math.log(Math.pow(10, 12) / usdcPerPing) / Math.log(1.0001);
      return Math.round(tick);
    };

    for (const pctChange of pricePctSteps) {
      // Bid level (price below current)
      const bidPrice = displayPrice * (1 - pctChange / 100);
      const bidSqrtP = Math.sqrt(bidPrice);
      const deltaToken1 = L * (sqrtP - bidSqrtP) / decimalFactor;

      if (deltaToken1 > 0) {
        // Calculate tick range for this level (±0.5% around the price)
        const tickAtPrice = priceToTick(bidPrice);
        const tickRange = Math.max(100, Math.abs(Math.round(tickAtPrice * 0.005))); // 0.5% range

        bids.push({
          price: bidPrice,
          token0Amount: 0,
          token1Amount: Math.abs(deltaToken1),
          liquidityUSD: Math.abs(deltaToken1),
          tickLower: tickAtPrice - tickRange,
          tickUpper: tickAtPrice + tickRange,
        });
      }

      // Ask level (price above current)
      const askPrice = displayPrice * (1 + pctChange / 100);
      const askSqrtP = Math.sqrt(askPrice);
      const deltaToken0 = L * (1 / sqrtP - 1 / askSqrtP) / decimalFactor;

      if (deltaToken0 > 0) {
        // Calculate tick range for this level
        const tickAtPrice = priceToTick(askPrice);
        const tickRange = Math.max(100, Math.abs(Math.round(tickAtPrice * 0.005)));

        asks.push({
          price: askPrice,
          token0Amount: Math.abs(deltaToken0),
          token1Amount: 0,
          liquidityUSD: Math.abs(deltaToken0) * priceUsd,
          tickLower: tickAtPrice - tickRange,
          tickUpper: tickAtPrice + tickRange,
        });
      }
    }

    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    console.log('V4 depth result:', {
      currentPrice: displayPrice,
      poolLiquidity: (liquidity as bigint).toString(),
      bidsCount: bids.length,
      asksCount: asks.length,
      sampleBid: bids[0],
      sampleAsk: asks[0],
    });

    const result: DepthData = {
      bids,
      asks,
      currentPrice: displayPrice,
      token0Symbol: symbol0,
      token1Symbol: symbol1,
      token0Decimals: decimals0,
      token1Decimals: decimals1,
    };

    // Cache the result
    setCachedLiquidity(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Error fetching V4 liquidity depth:', error);
    return null;
  }
}

export async function getLiquidityDepth(
  chainId: string,
  poolAddress: string,
  priceUsd: number,
  levels: number = 50
): Promise<DepthData | null> {
  try {
    const chain = CHAINS[chainId];
    const rpcUrl = getRpcUrl(chainId);

    if (!chain || !rpcUrl) {
      console.error('Unsupported chain:', chainId);
      return null;
    }

    // Validate address format
    if (!isValidEvmAddress(poolAddress)) {
      console.error('Invalid EVM address format:', poolAddress);
      return null;
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 30000 }), // 30 second timeout for multicall
    });

    // Get pool data
    const [slot0, poolLiquidity, tickSpacingRaw, token0Addr, token1Addr] = await Promise.all([
      client.readContract({
        address: poolAddress as `0x${string}`,
        abi: V3_POOL_ABI,
        functionName: 'slot0',
      }),
      client.readContract({
        address: poolAddress as `0x${string}`,
        abi: V3_POOL_ABI,
        functionName: 'liquidity',
      }),
      client.readContract({
        address: poolAddress as `0x${string}`,
        abi: V3_POOL_ABI,
        functionName: 'tickSpacing',
      }),
      client.readContract({
        address: poolAddress as `0x${string}`,
        abi: V3_POOL_ABI,
        functionName: 'token0',
      }),
      client.readContract({
        address: poolAddress as `0x${string}`,
        abi: V3_POOL_ABI,
        functionName: 'token1',
      }),
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

    // Determine base/quote tokens using known quote tokens
    const knownQuotePrices: Record<string, number> = {
      'WETH': 3500, 'ETH': 3500,
      'USDC': 1, 'USDT': 1, 'DAI': 1,
      'WBNB': 600, 'BNB': 600,
    };

    const symbol0Upper = (symbol0 as string).toUpperCase();
    const symbol1Upper = (symbol1 as string).toUpperCase();
    const token0IsKnownQuote = symbol0Upper in knownQuotePrices;
    const token1IsKnownQuote = symbol1Upper in knownQuotePrices;

    let isToken0Base: boolean;
    if (token1IsKnownQuote && !token0IsKnownQuote) {
      isToken0Base = true;
    } else if (token0IsKnownQuote && !token1IsKnownQuote) {
      isToken0Base = false;
    } else {
      isToken0Base = priceUsd < 1;
    }

    // Helper: convert tick to USD price
    // Uses the relationship: price(tick) = price(currentTick) * 1.0001^(tick - currentTick)
    // When tick > currentTick, price goes up (asks)
    // When tick < currentTick, price goes down (bids)
    const tickToPriceUsd = (tick: number): number => {
      const safeTick = Math.max(-887272, Math.min(887272, tick));
      const tickDelta = safeTick - currentTick;
      const price = priceUsd * Math.pow(1.0001, tickDelta);
      if (!isFinite(price) || price > 1e18) return 1e18;
      if (price < 1e-18) return 1e-18;
      return price;
    };

    console.log(`[V3 Depth] Pool: tick=${currentTick}, L=${poolLiquidity}, tickSpacing=${tickSpacing}`);

    // Query tick bitmap to find initialized ticks
    // Bitmap word position = tick / tickSpacing / 256
    const MIN_TICK = -887272;
    const MAX_TICK = 887272;
    const minWord = Math.floor(MIN_TICK / tickSpacing / 256);
    const maxWord = Math.ceil(MAX_TICK / tickSpacing / 256);

    // Build bitmap query calls
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

    // Execute bitmap multicall
    const bitmapResults = await client.readContract({
      address: MULTICALL3 as `0x${string}`,
      abi: MULTICALL3_ABI,
      functionName: 'aggregate3',
      args: [bitmapCalls],
    }) as Array<{ success: boolean; returnData: `0x${string}` }>;

    // Parse bitmaps to find initialized ticks
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
    console.log(`[V3 Depth] Found ${initializedTicks.length} initialized ticks`);

    // Query liquidityNet for each initialized tick using multicall
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
            }) as unknown as [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean];
            const liquidityNet = decoded[1]; // Second return value is liquidityNet
            tickLiquidityMap.set(initializedTicks[index], liquidityNet);
          } catch {
            // Skip invalid results
          }
        }
      });
    }

    // Calculate token amounts from liquidity
    const calculateToken0Amount = (L: bigint, tickLower: number, tickUpper: number): number => {
      const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
      const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
      if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper) || sqrtPriceLower === 0 || sqrtPriceUpper === 0) return 0;
      const deltaInvSqrt = 1 / sqrtPriceLower - 1 / sqrtPriceUpper;
      if (!isFinite(deltaInvSqrt)) return 0;
      const amount = Number(L) * deltaInvSqrt / (10 ** dec0);
      return isFinite(amount) && amount > 0 ? amount : 0;
    };

    const calculateToken1Amount = (L: bigint, tickLower: number, tickUpper: number): number => {
      const sqrtPriceLower = Math.pow(1.0001, tickLower / 2);
      const sqrtPriceUpper = Math.pow(1.0001, tickUpper / 2);
      if (!isFinite(sqrtPriceLower) || !isFinite(sqrtPriceUpper)) return 0;
      const deltaSqrt = sqrtPriceUpper - sqrtPriceLower;
      if (!isFinite(deltaSqrt)) return 0;
      const amount = Number(L) * deltaSqrt / (10 ** dec1);
      return isFinite(amount) && amount > 0 ? amount : 0;
    };

    // Build order book from tick data
    const bids: LiquidityLevel[] = [];
    const asks: LiquidityLevel[] = [];

    const allTicks = Array.from(tickLiquidityMap.keys()).sort((a, b) => a - b);
    const ticksAbove = allTicks.filter(t => t > currentTick);
    const ticksBelow = allTicks.filter(t => t <= currentTick).reverse(); // Descending

    // Get quote token USD price for liquidity USD calculation
    const currentPriceRatio = sqrtPriceX96ToPrice(sqrtPriceX96, dec0, dec1);
    const quoteUsdPrice = isToken0Base ? (currentPriceRatio > 0 ? priceUsd / currentPriceRatio : 0) : priceUsd * currentPriceRatio;

    // ASKS: price goes UP (tick increases) - sell base token, receive quote token
    // Traverse from current tick upward
    let askLiquidity = poolLiquidity as bigint;
    let prevTickAbove = currentTick;

    for (const tick of ticksAbove) {
      if (asks.length >= levels) break;

      const tickLower = prevTickAbove;
      const tickUpper = tick;

      if (askLiquidity > 0n) {
        const priceL = tickToPriceUsd(tickUpper);
        const priceU = tickToPriceUsd(tickLower);

        // For asks: selling token0 (base), which means token1 amount is what we calculate
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

      // Update liquidity when crossing tick
      const liquidityNet = tickLiquidityMap.get(tick) || 0n;
      askLiquidity = askLiquidity + liquidityNet;
      prevTickAbove = tick;
    }

    // BIDS: price goes DOWN (tick decreases) - buy base token with quote token
    // Traverse from current tick downward
    let bidLiquidity = poolLiquidity as bigint;
    let prevTickBelow = currentTick;

    for (const tick of ticksBelow) {
      if (bids.length >= levels) break;

      const tickUpper = prevTickBelow;
      const tickLower = tick;

      if (bidLiquidity > 0n) {
        const priceL = tickToPriceUsd(tickUpper);
        const priceU = tickToPriceUsd(tickLower);

        // For bids: buying token0 (base), paying with token1 (quote)
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

      // Update liquidity when crossing tick (subtract liquidityNet when going down)
      const liquidityNet = tickLiquidityMap.get(tick) || 0n;
      bidLiquidity = bidLiquidity - liquidityNet;
      prevTickBelow = tick;
    }

    // Sort: bids descending (highest price first), asks ascending
    bids.sort((a, b) => b.price - a.price);
    asks.sort((a, b) => a.price - b.price);

    const baseSymbol = isToken0Base ? symbol0 as string : symbol1 as string;
    const quoteSymbol = isToken0Base ? symbol1 as string : symbol0 as string;

    console.log(`[V3 Depth] Result: ${bids.length} bids, ${asks.length} asks, base=${baseSymbol}, quote=${quoteSymbol}`);

    return {
      bids,
      asks,
      currentPrice: priceUsd > 0 ? priceUsd : 1,
      token0Symbol: baseSymbol,
      token1Symbol: quoteSymbol,
      token0Decimals: isToken0Base ? dec0 : dec1,
      token1Decimals: isToken0Base ? dec1 : dec0,
    };
  } catch (error) {
    console.error('Error fetching V3 liquidity depth:', error);
    return null;
  }
}

// Simplified version using pool token balances (works for V2 style pools)
export async function getSimpleLiquidity(
  chainId: string,
  poolAddress: string
): Promise<{ token0: number; token1: number; token0Symbol: string; token1Symbol: string } | null> {
  try {
    const chain = CHAINS[chainId];
    const rpcUrl = getRpcUrl(chainId);

    if (!chain || !rpcUrl) return null;

    // Validate address format
    if (!isValidEvmAddress(poolAddress)) {
      console.error('Invalid EVM address format:', poolAddress);
      return null;
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 10000 }),
    });

    // Try to get token addresses
    let token0Addr: `0x${string}`, token1Addr: `0x${string}`;

    try {
      [token0Addr, token1Addr] = await Promise.all([
        client.readContract({
          address: poolAddress as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'token0',
        }),
        client.readContract({
          address: poolAddress as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'token1',
        }),
      ]) as [`0x${string}`, `0x${string}`];
    } catch {
      return null;
    }

    // Get token info and balances
    const [decimals0, decimals1, symbol0, symbol1, balance0, balance1] = await Promise.all([
      client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: token0Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [poolAddress as `0x${string}`] }),
      client.readContract({ address: token1Addr, abi: ERC20_ABI, functionName: 'balanceOf', args: [poolAddress as `0x${string}`] }),
    ]);

    return {
      token0: Number(formatUnits(balance0 as bigint, decimals0 as number)),
      token1: Number(formatUnits(balance1 as bigint, decimals1 as number)),
      token0Symbol: symbol0 as string,
      token1Symbol: symbol1 as string,
    };
  } catch (error) {
    console.error('Error fetching simple liquidity:', error);
    return null;
  }
}
