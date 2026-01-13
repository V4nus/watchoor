import { createPublicClient, http, parseAbiItem, formatUnits, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base, mainnet, arbitrum, polygon, bsc } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

// Uniswap V3 Pool Mint event
const V3_MINT_EVENT = parseAbiItem(
  'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
);

// Uniswap V3 Pool Burn event
const V3_BURN_EVENT = parseAbiItem(
  'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)'
);

// Uniswap V4 PoolManager ModifyLiquidity event
// event ModifyLiquidity(PoolId indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)
const V4_MODIFY_LIQUIDITY_EVENT = parseAbiItem(
  'event ModifyLiquidity(bytes32 indexed id, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)'
);

export interface LPPosition {
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: 'mint' | 'burn';
}

export interface PositionCache {
  poolAddress: string;
  chainId: string;
  lastBlock: number;
  positions: LPPosition[];
  updatedAt: number;
}

// Chain configuration with V4 PoolManager addresses
const CHAIN_CONFIG: Record<string, {
  chain: typeof base;
  rpcUrl?: string;
  blockRange: number;
  v4PoolManager?: string;
}> = {
  base: {
    chain: base,
    rpcUrl: 'https://base-rpc.publicnode.com', // Using publicnode - less restrictive rate limits
    blockRange: 5000, // Smaller range to avoid rate limits
    v4PoolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b', // Base V4 PoolManager
  },
  ethereum: {
    chain: mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
    blockRange: 2000,
    v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90', // Ethereum V4 PoolManager
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockRange: 10000,
    v4PoolManager: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32', // Arbitrum V4 PoolManager
  },
  polygon: {
    chain: polygon,
    rpcUrl: 'https://polygon-rpc.com',
    blockRange: 5000,
  },
  bsc: {
    chain: bsc,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockRange: 5000,
  },
};

// Cache directory
const CACHE_DIR = path.join(process.cwd(), '.cache', 'lp-positions');

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Get cache file path for a pool
function getCacheFilePath(chainId: string, poolAddress: string): string {
  return path.join(CACHE_DIR, `${chainId}_${poolAddress.toLowerCase()}.json`);
}

// Load cache from file
function loadCache(chainId: string, poolAddress: string): PositionCache | null {
  try {
    const filePath = getCacheFilePath(chainId, poolAddress);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return null;
}

// Save cache to file
function saveCache(cache: PositionCache) {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(cache.chainId, cache.poolAddress);
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Convert tick to price (approximate)
export function tickToPrice(tick: number, token0Decimals: number = 18, token1Decimals: number = 18): number {
  const price = Math.pow(1.0001, tick);
  return price * Math.pow(10, token0Decimals - token1Decimals);
}

// Check if address is V4 pool (32 bytes = 64 hex chars + 0x = 66 chars)
function isV4Pool(poolAddress: string): boolean {
  return poolAddress.length === 66; // 0x + 64 hex chars
}

// Query V3 LP positions from chain
async function queryV3Positions(
  client: ReturnType<typeof createPublicClient>,
  poolAddress: string,
  fromBlock: number,
  toBlock: number,
  blockRange: number
): Promise<LPPosition[]> {
  const positions: LPPosition[] = [];

  for (let from = fromBlock; from < toBlock; from += blockRange) {
    const to = Math.min(from + blockRange - 1, toBlock);

    try {
      // Query Mint events
      const mintLogs = await client.getLogs({
        address: poolAddress as `0x${string}`,
        event: V3_MINT_EVENT,
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      });

      // Query Burn events
      const burnLogs = await client.getLogs({
        address: poolAddress as `0x${string}`,
        event: V3_BURN_EVENT,
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      });

      // Process Mint events
      for (const log of mintLogs) {
        const args = log.args as {
          sender?: string;
          owner?: string;
          tickLower?: number;
          tickUpper?: number;
          amount?: bigint;
          amount0?: bigint;
          amount1?: bigint;
        };

        if (args.owner && args.tickLower !== undefined && args.tickUpper !== undefined) {
          let timestamp = Math.floor(Date.now() / 1000);
          try {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            timestamp = Number(block.timestamp);
          } catch {}

          positions.push({
            owner: args.owner,
            tickLower: Number(args.tickLower),
            tickUpper: Number(args.tickUpper),
            liquidity: args.amount?.toString() || '0',
            amount0: args.amount0?.toString() || '0',
            amount1: args.amount1?.toString() || '0',
            txHash: log.transactionHash || '',
            blockNumber: Number(log.blockNumber),
            timestamp,
            type: 'mint',
          });
        }
      }

      // Process Burn events
      for (const log of burnLogs) {
        const args = log.args as {
          owner?: string;
          tickLower?: number;
          tickUpper?: number;
          amount?: bigint;
          amount0?: bigint;
          amount1?: bigint;
        };

        if (args.owner && args.tickLower !== undefined && args.tickUpper !== undefined) {
          let timestamp = Math.floor(Date.now() / 1000);
          try {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            timestamp = Number(block.timestamp);
          } catch {}

          positions.push({
            owner: args.owner,
            tickLower: Number(args.tickLower),
            tickUpper: Number(args.tickUpper),
            liquidity: args.amount?.toString() || '0',
            amount0: args.amount0?.toString() || '0',
            amount1: args.amount1?.toString() || '0',
            txHash: log.transactionHash || '',
            blockNumber: Number(log.blockNumber),
            timestamp,
            type: 'burn',
          });
        }
      }

      console.log(`V3: Processed blocks ${from}-${to}, found ${mintLogs.length} mints, ${burnLogs.length} burns`);
    } catch (error) {
      console.error(`Error querying V3 blocks ${from}-${to}:`, error);
    }
  }

  return positions;
}

// Query V4 LP positions from PoolManager
async function queryV4Positions(
  client: ReturnType<typeof createPublicClient>,
  poolId: string,
  poolManagerAddress: string,
  fromBlock: number,
  toBlock: number,
  blockRange: number
): Promise<LPPosition[]> {
  const positions: LPPosition[] = [];

  // For V4, we need to query all ModifyLiquidity events and filter by poolId
  // The indexed bytes32 topic should match the poolId
  const poolIdLower = poolId.toLowerCase();

  // Use smaller batch size for V4 to avoid timeouts (2000 blocks per batch)
  const v4BatchSize = Math.min(blockRange, 2000);
  const totalBlocks = toBlock - fromBlock;
  const totalBatches = Math.ceil(totalBlocks / v4BatchSize);
  let currentBatch = 0;

  console.log(`[V4 LP] Starting scan: ${totalBlocks} blocks in ${totalBatches} batches`);
  console.log(`[V4 LP] Pool: ${poolId.slice(0, 18)}...`);

  for (let from = fromBlock; from < toBlock; from += v4BatchSize) {
    const to = Math.min(from + v4BatchSize - 1, toBlock);
    currentBatch++;
    const progress = Math.round((currentBatch / totalBatches) * 100);

    try {
      // Query all ModifyLiquidity events from PoolManager and filter manually
      // Using raw topics to filter by poolId
      // keccak256("ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)")
      const eventSignature = '0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec';

      const logs = await client.getLogs({
        address: poolManagerAddress as `0x${string}`,
        topics: [
          eventSignature,
          poolIdLower as `0x${string}`, // indexed poolId
        ],
        fromBlock: BigInt(from),
        toBlock: BigInt(to),
      });

      // Decode logs manually since we used raw topics
      for (const log of logs) {
        try {
          // topics[0] = event signature, topics[1] = poolId, topics[2] = sender
          const sender = log.topics[2] ? ('0x' + log.topics[2].slice(26)) as `0x${string}` : undefined;

          // Decode data: tickLower (int24), tickUpper (int24), liquidityDelta (int256), salt (bytes32)
          const data = log.data;
          // Need at least 194 chars for tickLower (64) + tickUpper (64) + liquidityDelta (64) + 0x prefix (2)
          if (!data || data.length < 194) {
            console.log('[V4 LP] Skipping log with short data:', data?.length);
            continue;
          }

          // int24 tickLower at offset 0 (padded to 32 bytes, value in last 6 hex chars = 3 bytes)
          const tickLowerHex = data.slice(2, 66);
          // Get only the last 6 hex chars (3 bytes = int24)
          const tickLowerValue = tickLowerHex.slice(-6);
          if (!/^[0-9a-fA-F]+$/.test(tickLowerValue)) {
            console.log('[V4 LP] Invalid tickLower hex');
            continue;
          }
          const tickLower = parseInt(tickLowerValue, 16);
          const tickLowerSigned = tickLower > 0x7FFFFF ? tickLower - 0x1000000 : tickLower;

          // int24 tickUpper at offset 32 (padded to 32 bytes, value in last 6 hex chars)
          const tickUpperHex = data.slice(66, 130);
          const tickUpperValue = tickUpperHex.slice(-6);
          if (!/^[0-9a-fA-F]+$/.test(tickUpperValue)) {
            console.log('[V4 LP] Invalid tickUpper hex');
            continue;
          }
          const tickUpper = parseInt(tickUpperValue, 16);
          const tickUpperSigned = tickUpper > 0x7FFFFF ? tickUpper - 0x1000000 : tickUpper;

          // int256 liquidityDelta at offset 64 (32 bytes = 64 hex chars)
          const liquidityHex = data.slice(130, 194);
          if (!liquidityHex || liquidityHex.length < 64 || !/^[0-9a-fA-F]+$/.test(liquidityHex)) {
            console.log('[V4 LP] Skipping log with invalid liquidity data:', liquidityHex?.slice(0, 20));
            continue;
          }

          let liquidityDelta: bigint;
          try {
            liquidityDelta = BigInt('0x' + liquidityHex);
          } catch (e) {
            console.log('[V4 LP] Failed to parse liquidity hex:', liquidityHex?.slice(0, 20));
            continue;
          }

          if (sender) {
            let timestamp = Math.floor(Date.now() / 1000);
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber! });
              timestamp = Number(block.timestamp);
            } catch {}

            // Check sign for int256 (if top bit is 1, it's negative)
            const isNegative = liquidityHex[0] >= '8';
            const isAdd = !isNegative;

            positions.push({
              owner: sender,
              tickLower: tickLowerSigned,
              tickUpper: tickUpperSigned,
              liquidity: liquidityDelta.toString(),
              amount0: '0',
              amount1: '0',
              txHash: log.transactionHash || '',
              blockNumber: Number(log.blockNumber),
              timestamp,
              type: isAdd ? 'mint' : 'burn',
            });
          }
        } catch (decodeError) {
          console.error('Error decoding V4 log:', decodeError);
        }
      }

      if (logs.length > 0) {
        console.log(`[V4 LP] ${progress}% - Found ${logs.length} events in blocks ${from}-${to}`);
      } else if (currentBatch % 10 === 0) {
        // Only log every 10th batch if no events found to reduce noise
        console.log(`[V4 LP] ${progress}% - Scanning blocks ${from}-${to}...`);
      }
    } catch (error) {
      console.error(`[V4 LP] Error at blocks ${from}-${to}:`, error instanceof Error ? error.message : error);
      // Continue to next batch instead of stopping
    }
  }

  console.log(`[V4 LP] Scan complete: Found ${positions.length} total events`);
  return positions;
}

// Query LP positions from chain (auto-detect V3/V4)
export async function queryLPPositions(
  chainId: string,
  poolAddress: string,
  fromBlock?: number,
  toBlock?: number
): Promise<LPPosition[]> {
  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl, { timeout: 30000 }), // 30 second timeout
  });

  const currentBlock = toBlock || Number(await client.getBlockNumber());
  const startBlock = fromBlock || Math.max(0, currentBlock - 100000);

  const isV4 = isV4Pool(poolAddress);
  console.log(`[LP] Scanning ${isV4 ? 'V4' : 'V3'} pool on ${chainId}`);
  console.log(`[LP] Block range: ${startBlock} to ${currentBlock} (${currentBlock - startBlock} blocks)`);

  if (isV4) {
    if (!config.v4PoolManager) {
      console.log(`No V4 PoolManager configured for ${chainId}`);
      return [];
    }
    return queryV4Positions(client, poolAddress, config.v4PoolManager, startBlock, currentBlock, config.blockRange);
  } else {
    return queryV3Positions(client, poolAddress, startBlock, currentBlock, config.blockRange);
  }
}

// Get LP positions with caching
export async function getLPPositions(
  chainId: string,
  poolAddress: string,
  forceRefresh: boolean = false
): Promise<LPPosition[]> {
  let cache = loadCache(chainId, poolAddress);

  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const currentBlock = Number(await client.getBlockNumber());

  // If cache exists and is recent, use it
  // But if cache has 0 positions, force refresh to try again
  if (cache && !forceRefresh && cache.positions.length > 0) {
    const blocksSinceUpdate = currentBlock - cache.lastBlock;
    if (blocksSinceUpdate < 1000) {
      console.log(`Using cached data (${cache.positions.length} positions, ${blocksSinceUpdate} blocks behind)`);
      return cache.positions;
    }

    // Update cache with new blocks only
    console.log(`Updating cache from block ${cache.lastBlock + 1}`);
    const newPositions = await queryLPPositions(chainId, poolAddress, cache.lastBlock + 1, currentBlock);

    cache.positions = [...cache.positions, ...newPositions];
    cache.lastBlock = currentBlock;
    cache.updatedAt = Date.now();
    saveCache(cache);

    return cache.positions;
  }

  // Query positions (limited to recent history)
  // V4 pools need larger range since they're newer and events may be sparse
  const isV4 = isV4Pool(poolAddress);
  const blockRange = isV4 ? 200000 : 50000; // V4: ~2 days, V3: ~1 day on Base
  const startBlock = Math.max(0, currentBlock - blockRange);
  console.log(`[LP] Querying ${isV4 ? 'V4' : 'V3'} positions from block ${startBlock} (${blockRange} blocks)`);
  const positions = await queryLPPositions(chainId, poolAddress, startBlock, currentBlock);

  // Save to cache
  cache = {
    poolAddress,
    chainId,
    lastBlock: currentBlock,
    positions,
    updatedAt: Date.now(),
  };
  saveCache(cache);

  return positions;
}

// Get positions in a specific tick range
export function getPositionsInRange(
  positions: LPPosition[],
  tickLower: number,
  tickUpper: number
): LPPosition[] {
  return positions.filter(p => {
    return p.tickLower <= tickUpper && p.tickUpper >= tickLower;
  });
}

// Get positions near a specific price
export function getPositionsNearPrice(
  positions: LPPosition[],
  targetTick: number,
  tickRange: number = 1000
): LPPosition[] {
  const tickLower = targetTick - tickRange;
  const tickUpper = targetTick + tickRange;
  return getPositionsInRange(positions, tickLower, tickUpper);
}

// Aggregate positions by owner
export function aggregateByOwner(positions: LPPosition[]): Map<string, LPPosition[]> {
  const byOwner = new Map<string, LPPosition[]>();
  for (const pos of positions) {
    const existing = byOwner.get(pos.owner) || [];
    existing.push(pos);
    byOwner.set(pos.owner, existing);
  }
  return byOwner;
}

// Get unique LP addresses
export function getUniqueLPs(positions: LPPosition[]): string[] {
  const owners = new Set<string>();
  for (const pos of positions) {
    owners.add(pos.owner);
  }
  return Array.from(owners);
}

// Format position for display
export function formatPosition(
  pos: LPPosition,
  token0Decimals: number = 18,
  token1Decimals: number = 18,
  token0Symbol: string = 'Token0',
  token1Symbol: string = 'Token1'
): {
  owner: string;
  ownerShort: string;
  priceLower: number;
  priceUpper: number;
  amount0: string;
  amount1: string;
  type: string;
  timestamp: string;
  txHash: string;
} {
  return {
    owner: pos.owner,
    ownerShort: `${pos.owner.slice(0, 6)}...${pos.owner.slice(-4)}`,
    priceLower: tickToPrice(pos.tickLower, token0Decimals, token1Decimals),
    priceUpper: tickToPrice(pos.tickUpper, token0Decimals, token1Decimals),
    amount0: pos.amount0 !== '0' ? `${formatUnits(BigInt(pos.amount0), token0Decimals)} ${token0Symbol}` : '-',
    amount1: pos.amount1 !== '0' ? `${formatUnits(BigInt(pos.amount1), token1Decimals)} ${token1Symbol}` : '-',
    type: pos.type === 'mint' ? 'Add Liquidity' : 'Remove Liquidity',
    timestamp: new Date(pos.timestamp * 1000).toLocaleString(),
    txHash: pos.txHash,
  };
}
