/**
 * Dune Analytics API Service
 * Used for fetching V4 LP position data more efficiently than RPC scanning
 */

import { prisma } from './db';

const DUNE_API_BASE = 'https://api.dune.com/api/v1';

interface DuneQueryResult {
  execution_id: string;
  state: string;
  result?: {
    rows: DuneLPRow[];
    metadata: {
      column_names: string[];
      result_set_bytes: number;
      total_row_count: number;
    };
  };
}

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

export interface DuneLPPosition {
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidityDelta: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  type: 'add' | 'remove';
}

// Cache for Dune results
const duneCache = new Map<string, { data: DuneLPPosition[]; timestamp: number }>();
const DUNE_CACHE_TTL = 300000; // 5 minutes

// Chain name mapping for Dune tables
const DUNE_CHAIN_MAP: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  bsc: 'bnb',
};

// Saved Query IDs on Dune (create these on dune.com)
const DUNE_QUERY_IDS: Record<string, number> = {
  // V4 LP positions query - uses raw logs from base.logs
  // Parameters: pool_id (text)
  v4_lp_positions_base: 6514713,
};

/**
 * Get Dune API key from environment
 */
function getDuneApiKey(): string | null {
  return process.env.DUNE_API_KEY || null;
}

/**
 * Execute a Dune query and wait for results
 */
async function executeDuneQuery(queryId: number, parameters?: Record<string, string>): Promise<DuneQueryResult | null> {
  const apiKey = getDuneApiKey();
  if (!apiKey) {
    console.log('[Dune] No API key configured');
    return null;
  }

  try {
    // Execute query
    const executeUrl = `${DUNE_API_BASE}/query/${queryId}/execute`;
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-API-Key': apiKey,
      },
      body: JSON.stringify({ query_parameters: parameters || {} }),
    });

    if (!executeResponse.ok) {
      console.error('[Dune] Execute failed:', executeResponse.status, await executeResponse.text());
      return null;
    }

    const executeData = await executeResponse.json();
    const executionId = executeData.execution_id;

    console.log(`[Dune] Query started, execution_id: ${executionId}`);

    // Poll for results (max 60 seconds)
    const maxWait = 60000;
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`;
      const statusResponse = await fetch(statusUrl, {
        headers: { 'X-Dune-API-Key': apiKey },
      });

      if (!statusResponse.ok) {
        console.error('[Dune] Status check failed:', statusResponse.status);
        return null;
      }

      const statusData = await statusResponse.json();
      console.log(`[Dune] Query state: ${statusData.state}`);

      if (statusData.state === 'QUERY_STATE_COMPLETED') {
        // Get results
        const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results`;
        const resultsResponse = await fetch(resultsUrl, {
          headers: { 'X-Dune-API-Key': apiKey },
        });

        if (!resultsResponse.ok) {
          console.error('[Dune] Results fetch failed:', resultsResponse.status);
          return null;
        }

        return await resultsResponse.json();
      }

      if (statusData.state === 'QUERY_STATE_FAILED') {
        console.error('[Dune] Query failed');
        return null;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.error('[Dune] Query timeout');
    return null;
  } catch (error) {
    console.error('[Dune] Error:', error);
    return null;
  }
}

/**
 * Run a custom SQL query on Dune
 */
async function runDuneSQL(sql: string): Promise<DuneLPRow[] | null> {
  const apiKey = getDuneApiKey();
  if (!apiKey) {
    console.log('[Dune] No API key configured');
    return null;
  }

  try {
    // Execute SQL query directly
    const executeUrl = `${DUNE_API_BASE}/query/execute/sql`;
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-API-Key': apiKey,
      },
      body: JSON.stringify({
        query_sql: sql,
        performance: 'medium', // Use medium for free tier
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('[Dune] SQL execute failed:', executeResponse.status, errorText);
      return null;
    }

    const executeData = await executeResponse.json();
    const executionId = executeData.execution_id;

    console.log(`[Dune] SQL query started, execution_id: ${executionId}`);

    // Poll for results (max 120 seconds for SQL queries)
    const maxWait = 120000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`;
      const statusResponse = await fetch(statusUrl, {
        headers: { 'X-Dune-API-Key': apiKey },
      });

      if (!statusResponse.ok) {
        console.error('[Dune] Status check failed:', statusResponse.status);
        return null;
      }

      const statusData = await statusResponse.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Dune] Query state: ${statusData.state} (${elapsed}s)`);

      if (statusData.state === 'QUERY_STATE_COMPLETED') {
        // Get results
        const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results`;
        const resultsResponse = await fetch(resultsUrl, {
          headers: { 'X-Dune-API-Key': apiKey },
        });

        if (!resultsResponse.ok) {
          console.error('[Dune] Results fetch failed:', resultsResponse.status);
          return null;
        }

        const results = await resultsResponse.json();
        return results.result?.rows || [];
      }

      if (statusData.state === 'QUERY_STATE_FAILED' || statusData.state === 'QUERY_STATE_CANCELLED') {
        console.error('[Dune] Query failed:', statusData.state);
        return null;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.error('[Dune] Query timeout');
    return null;
  } catch (error) {
    console.error('[Dune] Error:', error);
    return null;
  }
}

/**
 * Get V4 LP positions for a pool from Dune (with database caching)
 * Uses saved query ID to execute with pool_id parameter
 */
export async function getV4LPPositionsFromDune(
  chainId: string,
  poolId: string,
  limit: number = 100,
  forceRefresh: boolean = false
): Promise<DuneLPPosition[] | null> {
  const cacheKey = `dune:${chainId}:${poolId}:${limit}`;

  // Check memory cache first (fastest)
  const cached = duneCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DUNE_CACHE_TTL) {
    console.log('[Dune] Memory cache hit');
    return cached.data;
  }

  // Check database (second fastest)
  if (!forceRefresh) {
    const needsRefresh = await shouldRefreshFromDune(chainId, poolId);
    if (!needsRefresh) {
      const dbPositions = await getLPPositionsFromDb(chainId, poolId, limit);
      if (dbPositions && dbPositions.length > 0) {
        console.log('[Dune] Database cache hit');
        // Update memory cache
        duneCache.set(cacheKey, { data: dbPositions, timestamp: Date.now() });
        return dbPositions;
      }
    }
  }

  // Currently only Base chain is supported with saved query
  if (chainId !== 'base') {
    console.log(`[Dune] Chain ${chainId} not supported yet`);
    return null;
  }

  const queryId = DUNE_QUERY_IDS.v4_lp_positions_base;
  if (!queryId) {
    console.log('[Dune] No query ID configured');
    return null;
  }

  const apiKey = getDuneApiKey();
  if (!apiKey) {
    console.log('[Dune] No API key configured');
    return null;
  }

  console.log(`[Dune] Querying V4 LP positions for pool ${poolId.slice(0, 18)}...`);

  try {
    // Execute saved query with pool_id parameter
    const executeUrl = `${DUNE_API_BASE}/query/${queryId}/execute`;
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-API-Key': apiKey,
      },
      body: JSON.stringify({
        query_parameters: {
          pool_id: poolId,
        },
      }),
    });

    if (!executeResponse.ok) {
      console.error('[Dune] Execute failed:', executeResponse.status);
      // Try stale database data
      const dbPositions = await getLPPositionsFromDb(chainId, poolId, limit);
      if (dbPositions) {
        console.log('[Dune] Using stale database data after Dune failure');
        return dbPositions;
      }
      return null;
    }

    const executeData = await executeResponse.json();
    const executionId = executeData.execution_id;
    console.log(`[Dune] Query started, execution_id: ${executionId}`);

    // Poll for results (max 2 minutes for regular queries)
    const maxWait = 120000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`;
      const statusResponse = await fetch(statusUrl, {
        headers: { 'X-Dune-API-Key': apiKey },
      });

      if (!statusResponse.ok) {
        console.error('[Dune] Status check failed');
        return null;
      }

      const statusData = await statusResponse.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Dune] Query state: ${statusData.state} (${elapsed}s)`);

      if (statusData.state === 'QUERY_STATE_COMPLETED') {
        const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results`;
        const resultsResponse = await fetch(resultsUrl, {
          headers: { 'X-Dune-API-Key': apiKey },
        });

        if (!resultsResponse.ok) {
          console.error('[Dune] Results fetch failed');
          return null;
        }

        const results = await resultsResponse.json();
        const rows: DuneLPRow[] = results.result?.rows || [];

        console.log(`[Dune] Got ${rows.length} LP positions from API`);

        // Debug: log first row to see data structure
        if (rows.length > 0) {
          console.log('[Dune] First row sample:', JSON.stringify(rows[0], null, 2));
        }

        if (rows.length === 0) {
          return null;
        }

        // Transform to our format
        const positions: DuneLPPosition[] = rows.slice(0, limit).map(row => {
          const liquidityDelta = BigInt(row.liquidity_delta);
          const isAdd = liquidityDelta > 0n;

          return {
            owner: row.sender,
            tickLower: row.tick_lower,
            tickUpper: row.tick_upper,
            liquidityDelta: row.liquidity_delta.toString(),
            txHash: row.tx_hash,
            blockNumber: row.block_number,
            timestamp: new Date(row.block_time).getTime() / 1000,
            type: isAdd ? 'add' : 'remove',
          };
        });

        // Save to database in background (don't await)
        saveLPPositionsToDb(chainId, poolId, positions).catch(console.error);

        // Cache in memory
        duneCache.set(cacheKey, { data: positions, timestamp: Date.now() });

        return positions;
      }

      if (statusData.state === 'QUERY_STATE_FAILED' || statusData.state === 'QUERY_STATE_CANCELLED') {
        console.error('[Dune] Query failed:', statusData.state);
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.error('[Dune] Query timeout');
    return null;
  } catch (error) {
    console.error('[Dune] Error:', error);
    // Try stale database data
    const dbPositions = await getLPPositionsFromDb(chainId, poolId, limit);
    if (dbPositions) {
      console.log('[Dune] Using stale database data after error');
      return dbPositions;
    }
    return null;
  }
}

/**
 * Check if Dune API is available
 */
export function isDuneAvailable(): boolean {
  return !!getDuneApiKey();
}

/**
 * Sync ALL V4 LP positions for a pool from Dune to database
 * Uses saved query ID to execute with pool_id parameter
 */
export async function syncAllV4LPPositionsFromDune(
  chainId: string,
  poolId: string,
  onProgress?: (message: string, count: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  // Currently only Base chain is supported
  if (chainId !== 'base') {
    return { success: false, count: 0, error: `Chain ${chainId} not supported yet. Only Base is supported.` };
  }

  const queryId = DUNE_QUERY_IDS.v4_lp_positions_base;
  if (!queryId) {
    return { success: false, count: 0, error: 'No Dune query ID configured for Base' };
  }

  const apiKey = getDuneApiKey();
  if (!apiKey) {
    return { success: false, count: 0, error: 'No Dune API key configured' };
  }

  onProgress?.('Starting Dune query...', 0);
  console.log(`[Dune Sync] Fetching ALL LP positions for pool ${poolId.slice(0, 18)}...`);

  try {
    // Execute saved query with pool_id parameter
    const executeUrl = `${DUNE_API_BASE}/query/${queryId}/execute`;
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-API-Key': apiKey,
      },
      body: JSON.stringify({
        query_parameters: {
          pool_id: poolId,
        },
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      console.error('[Dune Sync] Execute failed:', errorText);
      return { success: false, count: 0, error: `Dune API error: ${executeResponse.status}` };
    }

    const executeData = await executeResponse.json();
    const executionId = executeData.execution_id;
    console.log(`[Dune Sync] Query started, execution_id: ${executionId}`);
    onProgress?.(`Query submitted (ID: ${executionId})`, 0);

    // Poll for results (max 5 minutes for full sync)
    const maxWait = 300000;
    const pollInterval = 5000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const statusUrl = `${DUNE_API_BASE}/execution/${executionId}/status`;
      const statusResponse = await fetch(statusUrl, {
        headers: { 'X-Dune-API-Key': apiKey },
      });

      if (!statusResponse.ok) {
        return { success: false, count: 0, error: 'Failed to check query status' };
      }

      const statusData = await statusResponse.json();
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Dune Sync] Query state: ${statusData.state} (${elapsed}s)`);
      onProgress?.(`Query state: ${statusData.state} (${elapsed}s)`, 0);

      if (statusData.state === 'QUERY_STATE_COMPLETED') {
        // Get results
        onProgress?.('Query complete, fetching results...', 0);
        const resultsUrl = `${DUNE_API_BASE}/execution/${executionId}/results`;
        const resultsResponse = await fetch(resultsUrl, {
          headers: { 'X-Dune-API-Key': apiKey },
        });

        if (!resultsResponse.ok) {
          return { success: false, count: 0, error: 'Failed to fetch results' };
        }

        const results = await resultsResponse.json();
        const rows: DuneLPRow[] = results.result?.rows || [];
        const totalRows = rows.length;

        console.log(`[Dune Sync] Got ${totalRows} total LP positions`);
        onProgress?.(`Got ${totalRows} positions, saving to database...`, totalRows);

        if (totalRows === 0) {
          return { success: true, count: 0 };
        }

        // Transform to our format
        const positions: DuneLPPosition[] = rows.map(row => {
          const liquidityDelta = BigInt(row.liquidity_delta);
          const isAdd = liquidityDelta > 0n;
          return {
            owner: row.sender,
            tickLower: row.tick_lower,
            tickUpper: row.tick_upper,
            liquidityDelta: row.liquidity_delta.toString(),
            txHash: row.tx_hash,
            blockNumber: row.block_number,
            timestamp: new Date(row.block_time).getTime() / 1000,
            type: isAdd ? 'add' : 'remove',
          };
        });

        // Save ALL to database
        await saveLPPositionsToDb(chainId, poolId, positions);
        onProgress?.(`Saved ${totalRows} positions to database`, totalRows);

        return { success: true, count: totalRows };
      }

      if (statusData.state === 'QUERY_STATE_FAILED' || statusData.state === 'QUERY_STATE_CANCELLED') {
        return { success: false, count: 0, error: `Query failed: ${statusData.state}` };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return { success: false, count: 0, error: 'Query timeout (5 min)' };
  } catch (error) {
    console.error('[Dune Sync] Error:', error);
    return { success: false, count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Save LP positions to database
 */
async function saveLPPositionsToDb(
  chainId: string,
  poolAddress: string,
  positions: DuneLPPosition[]
): Promise<void> {
  if (positions.length === 0) return;

  try {
    // First, ensure the pool exists in the database
    let pool = await prisma.pool.findUnique({
      where: {
        chainId_poolAddress: { chainId, poolAddress },
      },
    });

    if (!pool) {
      // Create a minimal pool record for V4 pools
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

    // Save positions using upsert to avoid duplicates
    for (const pos of positions) {
      await prisma.lPPosition.upsert({
        where: {
          txHash_tickLower_tickUpper_type: {
            txHash: pos.txHash,
            tickLower: pos.tickLower,
            tickUpper: pos.tickUpper,
            type: pos.type === 'add' ? 'mint' : 'burn',
          },
        },
        create: {
          poolId: pool.id,
          owner: pos.owner,
          tickLower: pos.tickLower,
          tickUpper: pos.tickUpper,
          liquidity: pos.liquidityDelta.replace('-', ''),
          amount0: '0',
          amount1: '0',
          txHash: pos.txHash,
          blockNumber: pos.blockNumber,
          timestamp: new Date(pos.timestamp * 1000),
          type: pos.type === 'add' ? 'mint' : 'burn',
        },
        update: {}, // No update needed if exists
      });
    }

    // Update sync status
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
        lastBlock: Math.max(...positions.map(p => p.blockNumber)),
        syncType: 'lp_positions_dune',
      },
      update: {
        lastBlock: Math.max(...positions.map(p => p.blockNumber)),
      },
    });

    console.log(`[Dune] Saved ${positions.length} LP positions to database`);
  } catch (error) {
    console.error('[Dune] Error saving to database:', error);
  }
}

/**
 * Get LP positions from database only (no API call)
 * Use this for regular loading, only call Dune API when user explicitly syncs
 */
async function getLPPositionsFromDb(
  chainId: string,
  poolAddress: string,
  limit: number = 100
): Promise<DuneLPPosition[] | null> {
  try {
    const pool = await prisma.pool.findUnique({
      where: {
        chainId_poolAddress: { chainId, poolAddress },
      },
    });

    if (!pool) {
      return null;
    }

    const positions = await prisma.lPPosition.findMany({
      where: { poolId: pool.id },
      orderBy: { blockNumber: 'desc' },
      take: limit,
    });

    if (positions.length === 0) {
      return null;
    }

    console.log(`[Dune] Found ${positions.length} LP positions in database`);

    return positions.map(pos => ({
      owner: pos.owner,
      tickLower: pos.tickLower,
      tickUpper: pos.tickUpper,
      liquidityDelta: pos.liquidity,
      txHash: pos.txHash,
      blockNumber: pos.blockNumber,
      timestamp: pos.timestamp.getTime() / 1000,
      type: pos.type === 'mint' ? 'add' : 'remove',
    }));
  } catch (error) {
    console.error('[Dune] Error reading from database:', error);
    return null;
  }
}

/**
 * Check if we need to refresh data from Dune
 */
async function shouldRefreshFromDune(chainId: string, poolAddress: string): Promise<boolean> {
  try {
    const syncStatus = await prisma.syncStatus.findUnique({
      where: {
        chainId_poolAddress_syncType: {
          chainId,
          poolAddress,
          syncType: 'lp_positions_dune',
        },
      },
    });

    if (!syncStatus) {
      return true; // Never synced
    }

    // Refresh if last sync was more than 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return syncStatus.updatedAt < tenMinutesAgo;
  } catch {
    return true;
  }
}

/**
 * Get LP positions from local database only (exported wrapper)
 * Use this for regular page loads - no API calls
 */
export async function getV4LPPositionsFromDb(
  chainId: string,
  poolId: string,
  limit: number = 100
): Promise<DuneLPPosition[] | null> {
  return getLPPositionsFromDb(chainId, poolId, limit);
}
