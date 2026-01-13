import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { base, mainnet, bsc, arbitrum, polygon } from 'viem/chains';
import { prisma } from '@/lib/db';

export interface Trade {
  txHash: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  volumeUsd: number;
  timestamp: string;
  blockNumber: number;
}

interface GeckoTrade {
  attributes: {
    tx_hash: string;
    block_timestamp: string;
    block_number: number;
    kind: string;
    from_token_amount: string;
    to_token_amount: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
    volume_in_usd: string;
  };
}

// Map chain IDs to GeckoTerminal network names
const NETWORK_MAP: Record<string, string> = {
  ethereum: 'eth',
  base: 'base',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  optimism: 'optimism',
  avalanche: 'avax',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAINS: Record<string, any> = {
  ethereum: mainnet,
  base: base,
  bsc: bsc,
  arbitrum: arbitrum,
  polygon: polygon,
};

const RPC_URLS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://base-rpc.publicnode.com',
  bsc: 'https://bsc-dataseed1.binance.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  polygon: 'https://polygon-rpc.com',
};

// V4 PoolManager addresses per chain
const V4_POOL_MANAGER: Record<string, string> = {
  ethereum: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  base: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  arbitrum: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
  polygon: '0x67366782805870060151383F4BbFF9daB53e5cD6',
  bsc: '0x28e2Ea090877bF75740558f6BFB36A5ffeE9e9dF',
};

// Cache duration: only fetch new trades if last sync was more than 10 seconds ago
const CACHE_DURATION_MS = 10000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!chainId || !poolAddress) {
    return NextResponse.json(
      { success: false, error: 'Missing chainId or poolAddress' },
      { status: 400 }
    );
  }

  try {
    const network = NETWORK_MAP[chainId] || chainId;

    // For V4 pools (66 char poolId), use database cache
    if (poolAddress.length === 66) {
      const v4Trades = await getV4TradesWithCache(chainId, poolAddress, limit);
      return NextResponse.json({
        success: true,
        data: v4Trades,
      });
    }

    const actualPoolAddress = poolAddress;

    const response = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${actualPoolAddress}/trades?trade_volume_in_usd_greater_than=0`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 5 }, // Cache for 5 seconds
      }
    );

    if (!response.ok) {
      console.error(`GeckoTerminal API error: ${response.status}`);
      return NextResponse.json({
        success: false,
        error: `API returned ${response.status}`,
      });
    }

    const result = await response.json();

    if (!result.data || !Array.isArray(result.data)) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Transform to our format
    const trades: Trade[] = result.data.slice(0, limit).map((trade: GeckoTrade) => {
      const attrs = trade.attributes;
      const isBuy = attrs.kind === 'buy';

      // For buy: from=quote(WETH), to=base(DRB) -> use price_to (base token price)
      // For sell: from=base(DRB), to=quote(WETH) -> use price_from (base token price)
      const baseTokenPrice = isBuy
        ? parseFloat(attrs.price_to_in_usd) || 0
        : parseFloat(attrs.price_from_in_usd) || 0;

      return {
        txHash: attrs.tx_hash,
        type: isBuy ? 'buy' : 'sell',
        price: baseTokenPrice,
        amount: parseFloat(isBuy ? attrs.to_token_amount : attrs.from_token_amount) || 0,
        volumeUsd: parseFloat(attrs.volume_in_usd) || 0,
        timestamp: attrs.block_timestamp,
        blockNumber: attrs.block_number,
      };
    });

    return NextResponse.json({
      success: true,
      data: trades,
    });
  } catch (error) {
    console.error('Trades API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}

// Get V4 trades with database caching
async function getV4TradesWithCache(
  chainId: string,
  poolId: string,
  limit: number
): Promise<Trade[]> {
  try {
    // Check last sync time
    const syncStatus = await prisma.syncStatus.findUnique({
      where: {
        chainId_poolAddress_syncType: {
          chainId,
          poolAddress: poolId,
          syncType: 'v4_trades',
        },
      },
    });

    const now = new Date();
    const shouldFetchNew = !syncStatus ||
      (now.getTime() - syncStatus.updatedAt.getTime() > CACHE_DURATION_MS);

    // Fetch new trades from chain if cache is stale
    if (shouldFetchNew) {
      const lastBlock = syncStatus?.lastBlock || 0;
      await fetchAndCacheV4Trades(chainId, poolId, lastBlock);
    }

    // Return cached trades from database
    const cachedTrades = await prisma.v4Trade.findMany({
      where: {
        chainId,
        poolId,
      },
      orderBy: {
        blockNumber: 'desc',
      },
      take: limit,
    });

    return cachedTrades.map(t => ({
      txHash: t.txHash,
      type: t.type as 'buy' | 'sell',
      price: t.price,
      amount: t.amount,
      volumeUsd: t.volumeUsd,
      timestamp: t.timestamp.toISOString(),
      blockNumber: t.blockNumber,
    }));
  } catch (error) {
    console.error('Error getting V4 trades with cache:', error);
    // Fallback: try to return whatever is in the cache
    try {
      const cachedTrades = await prisma.v4Trade.findMany({
        where: { chainId, poolId },
        orderBy: { blockNumber: 'desc' },
        take: limit,
      });
      return cachedTrades.map(t => ({
        txHash: t.txHash,
        type: t.type as 'buy' | 'sell',
        price: t.price,
        amount: t.amount,
        volumeUsd: t.volumeUsd,
        timestamp: t.timestamp.toISOString(),
        blockNumber: t.blockNumber,
      }));
    } catch {
      return [];
    }
  }
}

// Fetch new trades from chain and cache them
async function fetchAndCacheV4Trades(
  chainId: string,
  poolId: string,
  lastSyncedBlock: number
): Promise<void> {
  try {
    const chain = CHAINS[chainId];
    const rpcUrl = RPC_URLS[chainId];
    const poolManagerAddr = V4_POOL_MANAGER[chainId];

    if (!chain || !rpcUrl || !poolManagerAddr) {
      console.error('V4 not supported on chain:', chainId);
      return;
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 30000 }),
    });

    // Get current block number
    const currentBlock = await client.getBlockNumber();

    // If first sync, query last 10000 blocks; otherwise query from last synced block
    const startBlock = lastSyncedBlock > 0
      ? BigInt(lastSyncedBlock + 1)
      : currentBlock - 10000n;

    // Don't query if we're already up to date
    if (startBlock > currentBlock) {
      return;
    }

    console.log(`Fetching V4 Swap events for pool ${poolId.slice(0, 10)}... from block ${startBlock}`);

    // Fetch Swap events from PoolManager
    const logs = await client.getLogs({
      address: poolManagerAddr as `0x${string}`,
      event: {
        type: 'event',
        name: 'Swap',
        inputs: [
          { type: 'bytes32', name: 'id', indexed: true },
          { type: 'address', name: 'sender', indexed: true },
          { type: 'int128', name: 'amount0', indexed: false },
          { type: 'int128', name: 'amount1', indexed: false },
          { type: 'uint160', name: 'sqrtPriceX96', indexed: false },
          { type: 'uint128', name: 'liquidity', indexed: false },
          { type: 'int24', name: 'tick', indexed: false },
          { type: 'uint24', name: 'fee', indexed: false },
        ],
      },
      args: {
        id: poolId as `0x${string}`,
      },
      fromBlock: startBlock,
      toBlock: currentBlock,
    });

    console.log(`Found ${logs.length} new V4 Swap events`);

    if (logs.length > 0) {
      // Get block timestamps in batches
      const uniqueBlocks = [...new Set(logs.map(log => log.blockNumber))];
      const blockTimestamps = new Map<bigint, number>();

      const batchSize = 10;
      for (let i = 0; i < Math.min(uniqueBlocks.length, 50); i += batchSize) {
        const batch = uniqueBlocks.slice(i, i + batchSize);
        const blocks = await Promise.all(
          batch.map(blockNum => client.getBlock({ blockNumber: blockNum }))
        );
        blocks.forEach((block, idx) => {
          blockTimestamps.set(batch[idx], Number(block.timestamp));
        });
      }

      // Parse and save trades
      const tradesToSave = logs.map(log => {
        const args = log.args as {
          id: `0x${string}`;
          sender: `0x${string}`;
          amount0: bigint;
          amount1: bigint;
          sqrtPriceX96: bigint;
          liquidity: bigint;
          tick: number;
          fee: number;
        };

        const isBuy = args.amount0 > 0n;
        const usdcAmount = Math.abs(Number(args.amount0)) / 1e6;
        const baseAmount = Math.abs(Number(args.amount1)) / 1e18;
        const price = baseAmount > 0 ? usdcAmount / baseAmount : 0;
        const timestamp = blockTimestamps.get(log.blockNumber) || Math.floor(Date.now() / 1000);

        return {
          chainId,
          poolId,
          txHash: log.transactionHash,
          type: isBuy ? 'buy' : 'sell',
          price,
          amount: baseAmount,
          volumeUsd: usdcAmount,
          blockNumber: Number(log.blockNumber),
          timestamp: new Date(timestamp * 1000),
        };
      });

      // Upsert trades (skip duplicates)
      for (const trade of tradesToSave) {
        await prisma.v4Trade.upsert({
          where: {
            chainId_poolId_txHash: {
              chainId: trade.chainId,
              poolId: trade.poolId,
              txHash: trade.txHash,
            },
          },
          update: {}, // Don't update if exists
          create: trade,
        });
      }
    }

    // Update sync status
    await prisma.syncStatus.upsert({
      where: {
        chainId_poolAddress_syncType: {
          chainId,
          poolAddress: poolId,
          syncType: 'v4_trades',
        },
      },
      update: {
        lastBlock: Number(currentBlock),
        updatedAt: new Date(),
      },
      create: {
        chainId,
        poolAddress: poolId,
        syncType: 'v4_trades',
        lastBlock: Number(currentBlock),
      },
    });

    // Clean up old trades (keep only last 500)
    const tradeCount = await prisma.v4Trade.count({
      where: { chainId, poolId },
    });

    if (tradeCount > 500) {
      const oldTrades = await prisma.v4Trade.findMany({
        where: { chainId, poolId },
        orderBy: { blockNumber: 'desc' },
        skip: 500,
        select: { id: true },
      });

      if (oldTrades.length > 0) {
        await prisma.v4Trade.deleteMany({
          where: {
            id: { in: oldTrades.map(t => t.id) },
          },
        });
      }
    }
  } catch (error) {
    console.error('Error fetching and caching V4 trades:', error);
    // Don't throw - let the caller handle with cached data
  }
}
