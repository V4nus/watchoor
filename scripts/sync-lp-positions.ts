/**
 * Background sync script for LP positions from Dune Analytics
 *
 * This script periodically syncs LP position data from Dune to the local database.
 * Run with: npx tsx scripts/sync-lp-positions.ts
 *
 * For scheduled runs, use your system's task scheduler (cron on Linux, Task Scheduler on Windows)
 * or run with: node --loader ts-node/esm scripts/sync-lp-positions.ts --watch
 */

// Load environment variables FIRST
require('dotenv').config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Verify env is loaded
console.log('[Sync] DATABASE_URL:', process.env.DATABASE_URL ? 'configured' : 'NOT SET');

// Create Prisma client with pg adapter
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Dune API configuration
const DUNE_API_BASE = 'https://api.dune.com/api/v1';
const DUNE_API_KEY = process.env.DUNE_API_KEY;
const DUNE_QUERY_ID = 6514713; // V4 LP positions query for Base

// Sync interval (2 hours in milliseconds)
const SYNC_INTERVAL = 2 * 60 * 60 * 1000;

// List of pools to sync (add your pool IDs here)
const POOLS_TO_SYNC = [
  {
    chainId: 'base',
    poolAddress: '0x98c8f03094a9e65ccedc14c40130e4a5dd0ce14fb12ea58cbeac11f662b458b9', // PING/USDC V4
  },
  // Add more pools here as needed
];

interface DuneLPRow {
  block_number: number;
  block_time: string;
  tx_hash: string;
  pool_id: string;
  sender: string;
  tick_lower: number;
  tick_upper: number;
  liquidity_delta: string;
}

/**
 * Sync a single pool from Dune to database
 */
async function syncPool(chainId: string, poolAddress: string): Promise<{ success: boolean; count: number; error?: string }> {
  if (!DUNE_API_KEY) {
    return { success: false, count: 0, error: 'No DUNE_API_KEY configured' };
  }

  console.log(`[Sync] Starting sync for pool ${poolAddress.slice(0, 18)}...`);

  try {
    // Execute Dune query with retry
    const executeUrl = `${DUNE_API_BASE}/query/${DUNE_QUERY_ID}/execute`;

    let executeResponse;
    let executionId: string | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        executeResponse = await fetch(executeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dune-API-Key': DUNE_API_KEY,
          },
          body: JSON.stringify({
            query_parameters: {
              pool_id: poolAddress,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (executeResponse.ok) {
          const executeData = await executeResponse.json();
          executionId = executeData.execution_id;
          break;
        } else {
          const errorText = await executeResponse.text();
          console.log(`[Sync] Query submit failed (attempt ${attempt + 1}/3): ${executeResponse.status}`);
          if (attempt === 2) {
            return { success: false, count: 0, error: `Dune API error: ${executeResponse.status} - ${errorText}` };
          }
        }
      } catch (fetchError) {
        console.log(`[Sync] Network error submitting query (attempt ${attempt + 1}/3), retrying...`);
        if (attempt === 2) {
          return { success: false, count: 0, error: 'Failed to submit query after 3 attempts' };
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!executionId) {
      return { success: false, count: 0, error: 'Failed to get execution ID' };
    }

    console.log(`[Sync] Query submitted, execution_id: ${executionId}`);

    // Poll for results (max 5 minutes)
    const maxWait = 300000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`;

      let statusResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        statusResponse = await fetch(statusUrl, {
          headers: { 'X-Dune-API-Key': DUNE_API_KEY },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        console.log(`[Sync] Network error checking status, retrying...`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      if (!statusResponse.ok) {
        return { success: false, count: 0, error: 'Failed to check query status' };
      }

      const statusData = await statusResponse.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Sync] Query state: ${statusData.state} (${elapsed}s)`);

      if (statusData.state === 'QUERY_STATE_COMPLETED') {
        // Get ALL results using pagination
        const allRows: DuneLPRow[] = [];
        const pageSize = 10000; // Max rows per page
        let offset = 0;
        let hasMore = true;

        console.log(`[Sync] Fetching all results with pagination...`);

        while (hasMore) {
          const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results?limit=${pageSize}&offset=${offset}`;

          let resultsResponse;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for results
              resultsResponse = await fetch(resultsUrl, {
                headers: { 'X-Dune-API-Key': DUNE_API_KEY },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              break;
            } catch (fetchError) {
              console.log(`[Sync] Network error fetching results (attempt ${attempt + 1}/3), retrying...`);
              if (attempt === 2) {
                return { success: false, count: allRows.length, error: 'Failed to fetch results after 3 attempts' };
              }
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }

          if (!resultsResponse || !resultsResponse.ok) {
            return { success: false, count: allRows.length, error: 'Failed to fetch results' };
          }

          const results = await resultsResponse.json();
          const rows: DuneLPRow[] = results.result?.rows || [];

          console.log(`[Sync] Page ${Math.floor(offset / pageSize) + 1}: Got ${rows.length} rows (total: ${allRows.length + rows.length})`);

          allRows.push(...rows);

          // Check if there are more results
          if (rows.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }

        console.log(`[Sync] Total: ${allRows.length} LP positions from Dune`);

        if (allRows.length === 0) {
          return { success: true, count: 0 };
        }

        // Save to database
        await savePositionsToDb(chainId, poolAddress, allRows);
        return { success: true, count: allRows.length };
      }

      if (statusData.state === 'QUERY_STATE_FAILED' || statusData.state === 'QUERY_STATE_CANCELLED') {
        return { success: false, count: 0, error: `Query failed: ${statusData.state}` };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, count: 0, error: 'Query timeout (5 min)' };
  } catch (error) {
    return { success: false, count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Save LP positions to database
 */
async function savePositionsToDb(chainId: string, poolAddress: string, rows: DuneLPRow[]): Promise<void> {
  // Ensure pool exists
  let pool = await prisma.pool.findUnique({
    where: {
      chainId_poolAddress: { chainId, poolAddress },
    },
  });

  if (!pool) {
    pool = await prisma.pool.create({
      data: {
        chainId,
        poolAddress,
        dex: 'uniswap_v4',
        baseSymbol: 'Unknown',
        quoteSymbol: 'Unknown',
        baseAddress: '',
        quoteAddress: '',
        priceUsd: 0,
        liquidity: 0,
        volume24h: 0,
      },
    });
  }

  // Save positions in batches
  let saved = 0;
  for (const row of rows) {
    try {
      const liquidityDelta = BigInt(row.liquidity_delta);
      const isAdd = liquidityDelta > 0n;

      await prisma.lPPosition.upsert({
        where: {
          txHash_tickLower_tickUpper_type: {
            txHash: row.tx_hash,
            tickLower: row.tick_lower,
            tickUpper: row.tick_upper,
            type: isAdd ? 'mint' : 'burn',
          },
        },
        create: {
          poolId: pool.id,
          owner: row.sender,
          tickLower: row.tick_lower,
          tickUpper: row.tick_upper,
          liquidity: row.liquidity_delta.replace('-', ''),
          amount0: '0',
          amount1: '0',
          txHash: row.tx_hash,
          blockNumber: row.block_number,
          timestamp: new Date(row.block_time),
          type: isAdd ? 'mint' : 'burn',
        },
        update: {},
      });
      saved++;
    } catch (e) {
      // Skip duplicates or errors
    }
  }

  // Update sync status
  const maxBlock = Math.max(...rows.map(r => r.block_number));
  await prisma.syncStatus.upsert({
    where: {
      chainId_poolAddress_syncType: {
        chainId,
        poolAddress,
        syncType: 'lp_positions_dune',
      },
    },
    create: {
      chainId,
      poolAddress,
      lastBlock: maxBlock,
      syncType: 'lp_positions_dune',
    },
    update: {
      lastBlock: maxBlock,
    },
  });

  console.log(`[Sync] Saved ${saved} positions to database`);
}

/**
 * Run sync for all configured pools
 */
async function syncAllPools(): Promise<void> {
  console.log('\n========================================');
  console.log(`[Sync] Starting sync at ${new Date().toISOString()}`);
  console.log('========================================\n');

  for (const pool of POOLS_TO_SYNC) {
    const result = await syncPool(pool.chainId, pool.poolAddress);
    if (result.success) {
      console.log(`[Sync] Success: ${result.count} positions synced for ${pool.poolAddress.slice(0, 18)}`);
    } else {
      console.error(`[Sync] Failed: ${result.error}`);
    }

    // Small delay between pools to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n[Sync] Completed at ${new Date().toISOString()}`);
  console.log(`[Sync] Next sync in ${SYNC_INTERVAL / 60000} minutes\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('LP Position Sync Service');
  console.log('========================');
  console.log(`DUNE_API_KEY: ${DUNE_API_KEY ? 'configured' : 'NOT SET'}`);
  console.log(`Sync interval: ${SYNC_INTERVAL / 60000} minutes`);
  console.log(`Pools to sync: ${POOLS_TO_SYNC.length}`);
  console.log('');

  if (!DUNE_API_KEY) {
    console.error('ERROR: DUNE_API_KEY environment variable is not set');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }

  // Run initial sync
  await syncAllPools();

  // Check if running in watch mode
  if (process.argv.includes('--watch') || process.argv.includes('-w')) {
    console.log('[Sync] Running in watch mode, will sync every 2 hours...');

    // Schedule recurring sync
    setInterval(syncAllPools, SYNC_INTERVAL);
  } else {
    // Single run mode
    console.log('[Sync] Single run complete. Use --watch for continuous sync.');
    await prisma.$disconnect();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Sync] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Sync] Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(async (e) => {
  console.error('[Sync] Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
