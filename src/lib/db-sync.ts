// Database sync service - syncs on-chain data to PostgreSQL
import prisma from './db';
import { getPoolInfo } from './api';
import { getLiquidityDepth, DepthData } from './liquidity';

/**
 * Sync pool info from DexScreener to database
 */
export async function syncPoolInfo(chainId: string, poolAddress: string) {
  try {
    const poolInfo = await getPoolInfo(chainId, poolAddress);
    if (!poolInfo) {
      console.error('Failed to fetch pool info from DexScreener');
      return null;
    }

    // Upsert pool record
    const pool = await prisma.pool.upsert({
      where: {
        chainId_poolAddress: {
          chainId,
          poolAddress: poolAddress.toLowerCase(),
        },
      },
      update: {
        priceUsd: poolInfo.priceUsd,
        liquidity: poolInfo.liquidity,
        volume24h: poolInfo.volume24h,
        baseImageUrl: poolInfo.baseToken.imageUrl,
      },
      create: {
        chainId,
        poolAddress: poolAddress.toLowerCase(),
        dex: poolInfo.dex,
        baseSymbol: poolInfo.baseToken.symbol,
        quoteSymbol: poolInfo.quoteToken.symbol,
        baseAddress: poolInfo.baseToken.address.toLowerCase(),
        quoteAddress: poolInfo.quoteToken.address.toLowerCase(),
        baseDecimals: poolInfo.baseToken.decimals || 18,
        quoteDecimals: poolInfo.quoteToken.decimals || 18,
        baseImageUrl: poolInfo.baseToken.imageUrl,
        priceUsd: poolInfo.priceUsd,
        liquidity: poolInfo.liquidity,
        volume24h: poolInfo.volume24h,
      },
    });

    console.log(`Synced pool info: ${chainId}/${poolAddress}`);
    return pool;
  } catch (error) {
    console.error('Error syncing pool info:', error);
    return null;
  }
}

/**
 * Sync liquidity depth to database
 */
export async function syncLiquidityDepth(chainId: string, poolAddress: string, priceUsd: number) {
  try {
    // Get pool from database first
    let pool = await prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId,
          poolAddress: poolAddress.toLowerCase(),
        },
      },
    });

    // If pool doesn't exist, sync it first
    if (!pool) {
      pool = await syncPoolInfo(chainId, poolAddress);
      if (!pool) return null;
    }

    // Fetch liquidity depth from RPC
    const depthData = await getLiquidityDepth(chainId, poolAddress, priceUsd, 50);
    if (!depthData) {
      console.error('Failed to fetch liquidity depth from RPC');
      return null;
    }

    // Store snapshot in database
    const snapshot = await prisma.liquiditySnapshot.create({
      data: {
        poolId: pool.id,
        currentPrice: depthData.currentPrice,
        bidsJson: JSON.stringify(depthData.bids),
        asksJson: JSON.stringify(depthData.asks),
        token0Symbol: depthData.token0Symbol,
        token1Symbol: depthData.token1Symbol,
      },
    });

    // Clean up old snapshots (keep last 100)
    const oldSnapshots = await prisma.liquiditySnapshot.findMany({
      where: { poolId: pool.id },
      orderBy: { createdAt: 'desc' },
      skip: 100,
      select: { id: true },
    });

    if (oldSnapshots.length > 0) {
      await prisma.liquiditySnapshot.deleteMany({
        where: {
          id: { in: oldSnapshots.map(s => s.id) },
        },
      });
    }

    console.log(`Synced liquidity depth: ${chainId}/${poolAddress}`);
    return snapshot;
  } catch (error) {
    console.error('Error syncing liquidity depth:', error);
    return null;
  }
}

/**
 * Get latest liquidity depth from database
 */
export async function getLatestLiquidityFromDb(chainId: string, poolAddress: string): Promise<DepthData | null> {
  try {
    const pool = await prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId,
          poolAddress: poolAddress.toLowerCase(),
        },
      },
      include: {
        liquiditySnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!pool || pool.liquiditySnapshots.length === 0) {
      return null;
    }

    const snapshot = pool.liquiditySnapshots[0];

    // Check if snapshot is recent enough (within 2 minutes)
    const age = Date.now() - snapshot.createdAt.getTime();
    if (age > 120000) {
      return null; // Too old, need fresh data
    }

    return {
      bids: JSON.parse(snapshot.bidsJson),
      asks: JSON.parse(snapshot.asksJson),
      currentPrice: snapshot.currentPrice,
      token0Symbol: snapshot.token0Symbol,
      token1Symbol: snapshot.token1Symbol,
      token0Decimals: pool.baseDecimals,
      token1Decimals: pool.quoteDecimals,
    };
  } catch (error) {
    console.error('Error getting liquidity from database:', error);
    return null;
  }
}

/**
 * Get pool info from database
 */
export async function getPoolFromDb(chainId: string, poolAddress: string) {
  try {
    return await prisma.pool.findUnique({
      where: {
        chainId_poolAddress: {
          chainId,
          poolAddress: poolAddress.toLowerCase(),
        },
      },
    });
  } catch (error) {
    console.error('Error getting pool from database:', error);
    return null;
  }
}

/**
 * Save quote token price to database
 */
export async function saveQuotePrice(symbol: string, priceUsd: number) {
  try {
    await prisma.quotePrice.upsert({
      where: { symbol: symbol.toUpperCase() },
      update: { priceUsd },
      create: { symbol: symbol.toUpperCase(), priceUsd },
    });
  } catch (error) {
    console.error('Error saving quote price:', error);
  }
}

/**
 * Get quote token price from database
 */
export async function getQuotePriceFromDb(symbol: string): Promise<number | null> {
  try {
    const record = await prisma.quotePrice.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });

    if (!record) return null;

    // Check if price is recent (within 5 minutes)
    const age = Date.now() - record.updatedAt.getTime();
    if (age > 300000) {
      return null; // Too old
    }

    return record.priceUsd;
  } catch (error) {
    console.error('Error getting quote price from database:', error);
    return null;
  }
}

/**
 * Sync all watched pools (called periodically)
 */
export async function syncWatchedPools() {
  try {
    // Get all pools that have been accessed recently
    const pools = await prisma.pool.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 3600000), // Updated in last hour
        },
      },
    });

    console.log(`Syncing ${pools.length} watched pools...`);

    for (const pool of pools) {
      try {
        await syncPoolInfo(pool.chainId, pool.poolAddress);
        await syncLiquidityDepth(pool.chainId, pool.poolAddress, pool.priceUsd);

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error syncing pool ${pool.chainId}/${pool.poolAddress}:`, error);
      }
    }

    console.log('Finished syncing watched pools');
  } catch (error) {
    console.error('Error in syncWatchedPools:', error);
  }
}
