import Database from 'better-sqlite3';
import path from 'path';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base, mainnet, arbitrum, polygon, bsc } from 'viem/chains';

// Database file location
const DB_PATH = path.join(process.cwd(), '.cache', 'lp-positions.db');

// Ensure database directory exists
import fs from 'fs';
const cacheDir = path.dirname(DB_PATH);
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS lp_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    owner TEXT NOT NULL,
    tick_lower INTEGER NOT NULL,
    tick_upper INTEGER NOT NULL,
    liquidity TEXT NOT NULL,
    amount0 TEXT NOT NULL,
    amount1 TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    UNIQUE(chain_id, pool_address, tx_hash, tick_lower, tick_upper, event_type)
  );

  CREATE TABLE IF NOT EXISTS sync_status (
    chain_id TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    last_synced_block INTEGER NOT NULL,
    pool_creation_block INTEGER,
    is_syncing INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (chain_id, pool_address)
  );

  CREATE INDEX IF NOT EXISTS idx_positions_pool ON lp_positions(chain_id, pool_address);
  CREATE INDEX IF NOT EXISTS idx_positions_owner ON lp_positions(owner);
  CREATE INDEX IF NOT EXISTS idx_positions_ticks ON lp_positions(tick_lower, tick_upper);
`);

export interface LPPositionRow {
  id: number;
  chain_id: string;
  pool_address: string;
  owner: string;
  tick_lower: number;
  tick_upper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
  tx_hash: string;
  block_number: number;
  timestamp: number;
  event_type: string;
}

export interface SyncStatus {
  chain_id: string;
  pool_address: string;
  last_synced_block: number;
  pool_creation_block: number | null;
  is_syncing: number;
  updated_at: number;
}

// V4 ModifyLiquidity event signature
const V4_MODIFY_LIQUIDITY_SIGNATURE = '0xf208f4912782fd25c7f114ca3723a2d5dd6f3bcc3ac8db5af63baa85f711d5ec';

// V3 Mint and Burn event signatures
const V3_MINT_SIGNATURE = '0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde';
const V3_BURN_SIGNATURE = '0x0c396cd989a39f4459b5fa1aed6a9a8dcdbc45908acfd67e028cd568da98982c';

// Chain configuration
const CHAIN_CONFIG: Record<string, {
  chain: typeof base;
  rpcUrl: string;
  blockRange: number;
  v4PoolManager?: string;
}> = {
  base: {
    chain: base,
    rpcUrl: 'https://base.llamarpc.com',
    blockRange: 2000, // Smaller range for reliability
    v4PoolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
  },
  ethereum: {
    chain: mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
    blockRange: 1000,
    v4PoolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockRange: 5000,
    v4PoolManager: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
  },
  polygon: {
    chain: polygon,
    rpcUrl: 'https://polygon-rpc.com',
    blockRange: 2000,
  },
  bsc: {
    chain: bsc,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockRange: 2000,
  },
};

// Check if pool is V4 (32 bytes = 66 characters including 0x)
function isV4Pool(poolAddress: string): boolean {
  return poolAddress.length === 66;
}

// Get sync status for a pool
export function getSyncStatus(chainId: string, poolAddress: string): SyncStatus | null {
  const stmt = db.prepare('SELECT * FROM sync_status WHERE chain_id = ? AND pool_address = ?');
  return stmt.get(chainId, poolAddress.toLowerCase()) as SyncStatus | null;
}

// Update sync status
export function updateSyncStatus(
  chainId: string,
  poolAddress: string,
  lastBlock: number,
  creationBlock?: number
) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sync_status (chain_id, pool_address, last_synced_block, pool_creation_block, is_syncing, updated_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `);
  stmt.run(chainId, poolAddress.toLowerCase(), lastBlock, creationBlock || null, Date.now());
}

// Set syncing flag
export function setSyncing(chainId: string, poolAddress: string, syncing: boolean) {
  const stmt = db.prepare('UPDATE sync_status SET is_syncing = ? WHERE chain_id = ? AND pool_address = ?');
  stmt.run(syncing ? 1 : 0, chainId, poolAddress.toLowerCase());
}

// Insert LP position
export function insertPosition(position: Omit<LPPositionRow, 'id'>) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lp_positions
    (chain_id, pool_address, owner, tick_lower, tick_upper, liquidity, amount0, amount1, tx_hash, block_number, timestamp, event_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    position.chain_id,
    position.pool_address.toLowerCase(),
    position.owner.toLowerCase(),
    position.tick_lower,
    position.tick_upper,
    position.liquidity,
    position.amount0,
    position.amount1,
    position.tx_hash,
    position.block_number,
    position.timestamp,
    position.event_type
  );
}

// Get positions for a pool
export function getPositions(
  chainId: string,
  poolAddress: string,
  tickLower?: number,
  tickUpper?: number,
  limit: number = 100
): LPPositionRow[] {
  let query = 'SELECT * FROM lp_positions WHERE chain_id = ? AND pool_address = ?';
  const params: (string | number)[] = [chainId, poolAddress.toLowerCase()];

  if (tickLower !== undefined && tickUpper !== undefined) {
    query += ' AND tick_lower <= ? AND tick_upper >= ?';
    params.push(tickUpper, tickLower); // Overlapping ranges
  }

  query += ' ORDER BY block_number DESC, timestamp DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params) as LPPositionRow[];
}

// Get position count for a pool
export function getPositionCount(chainId: string, poolAddress: string): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM lp_positions WHERE chain_id = ? AND pool_address = ?');
  const result = stmt.get(chainId, poolAddress.toLowerCase()) as { count: number };
  return result.count;
}

// Find pool creation block by querying first event
async function findPoolCreationBlock(
  chainId: string,
  poolAddress: string
): Promise<number | null> {
  const config = CHAIN_CONFIG[chainId];
  if (!config) return null;

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const isV4 = isV4Pool(poolAddress);
  const currentBlock = Number(await client.getBlockNumber());

  // Binary search to find the first event
  let low = 0;
  let high = currentBlock;
  let firstEventBlock: number | null = null;

  // For V4, search from a reasonable starting point (V4 is relatively new)
  if (isV4) {
    // V4 launched around block 20000000 on Base
    low = chainId === 'base' ? 20000000 : Math.max(0, currentBlock - 5000000);
  }

  console.log(`Searching for pool creation block: ${poolAddress} on ${chainId}`);
  console.log(`Search range: ${low} to ${high}`);

  // Simplified search: check recent blocks first
  const searchRanges = [
    [currentBlock - 100000, currentBlock],    // Last ~1 day
    [currentBlock - 500000, currentBlock - 100000], // Last ~5 days
    [currentBlock - 2000000, currentBlock - 500000], // Last ~20 days
    [low, currentBlock - 2000000],            // Earlier
  ];

  for (const [rangeStart, rangeEnd] of searchRanges) {
    if (rangeStart >= rangeEnd) continue;

    try {
      let logs;
      if (isV4 && config.v4PoolManager) {
        logs = await client.getLogs({
          address: config.v4PoolManager as `0x${string}`,
          topics: [V4_MODIFY_LIQUIDITY_SIGNATURE, poolAddress.toLowerCase() as `0x${string}`],
          fromBlock: BigInt(rangeStart),
          toBlock: BigInt(Math.min(rangeStart + config.blockRange, rangeEnd)),
        });
      } else {
        logs = await client.getLogs({
          address: poolAddress as `0x${string}`,
          topics: [V3_MINT_SIGNATURE],
          fromBlock: BigInt(rangeStart),
          toBlock: BigInt(Math.min(rangeStart + config.blockRange, rangeEnd)),
        });
      }

      if (logs.length > 0) {
        firstEventBlock = Number(logs[0].blockNumber);
        console.log(`Found first event at block ${firstEventBlock}`);
        break;
      }
    } catch (error) {
      console.error(`Error searching range ${rangeStart}-${rangeEnd}:`, error);
    }
  }

  return firstEventBlock;
}

// Sync positions from chain to database
export async function syncPositions(
  chainId: string,
  poolAddress: string,
  progressCallback?: (current: number, total: number, positions: number) => void
): Promise<{ synced: number; total: number }> {
  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  // Check if already syncing
  let status = getSyncStatus(chainId, poolAddress);
  if (status?.is_syncing) {
    console.log('Sync already in progress');
    return { synced: 0, total: 0 };
  }

  const client = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const currentBlock = Number(await client.getBlockNumber());
  const isV4 = isV4Pool(poolAddress);

  // Determine starting block
  let startBlock: number;
  if (status?.last_synced_block) {
    startBlock = status.last_synced_block + 1;
  } else {
    // Find pool creation block
    const creationBlock = await findPoolCreationBlock(chainId, poolAddress);
    startBlock = creationBlock || Math.max(0, currentBlock - 100000);
    updateSyncStatus(chainId, poolAddress, startBlock - 1, creationBlock || undefined);
  }

  if (startBlock >= currentBlock) {
    console.log('Already synced to current block');
    return { synced: 0, total: 0 };
  }

  // Set syncing flag
  setSyncing(chainId, poolAddress, true);

  const totalBlocks = currentBlock - startBlock;
  let syncedPositions = 0;

  console.log(`Syncing ${poolAddress} on ${chainId} from block ${startBlock} to ${currentBlock}`);

  try {
    for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += config.blockRange) {
      const toBlock = Math.min(fromBlock + config.blockRange - 1, currentBlock);

      try {
        let logs;
        if (isV4 && config.v4PoolManager) {
          // Query V4 ModifyLiquidity events
          logs = await client.getLogs({
            address: config.v4PoolManager as `0x${string}`,
            topics: [V4_MODIFY_LIQUIDITY_SIGNATURE, poolAddress.toLowerCase() as `0x${string}`],
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock),
          });

          // Process V4 logs
          for (const log of logs) {
            const sender = log.topics[2] ? ('0x' + log.topics[2].slice(26)) : '';
            const data = log.data;
            if (!data || data.length < 194) continue;

            const tickLowerHex = data.slice(2, 66);
            const tickLower = parseInt(tickLowerHex, 16);
            const tickLowerSigned = tickLower > 0x7FFFFF ? tickLower - 0x1000000 : tickLower;

            const tickUpperHex = data.slice(66, 130);
            const tickUpper = parseInt(tickUpperHex, 16);
            const tickUpperSigned = tickUpper > 0x7FFFFF ? tickUpper - 0x1000000 : tickUpper;

            const liquidityHex = data.slice(130, 194);
            const liquidityDelta = BigInt('0x' + liquidityHex);
            const isNegative = liquidityHex[0] >= '8';

            // Get block timestamp
            let timestamp = Math.floor(Date.now() / 1000);
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber! });
              timestamp = Number(block.timestamp);
            } catch {}

            insertPosition({
              chain_id: chainId,
              pool_address: poolAddress,
              owner: sender,
              tick_lower: tickLowerSigned,
              tick_upper: tickUpperSigned,
              liquidity: liquidityDelta.toString(),
              amount0: '0',
              amount1: '0',
              tx_hash: log.transactionHash || '',
              block_number: Number(log.blockNumber),
              timestamp,
              event_type: isNegative ? 'burn' : 'mint',
            });
            syncedPositions++;
          }
        } else {
          // Query V3 Mint events
          const mintLogs = await client.getLogs({
            address: poolAddress as `0x${string}`,
            topics: [V3_MINT_SIGNATURE],
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock),
          });

          // Query V3 Burn events
          const burnLogs = await client.getLogs({
            address: poolAddress as `0x${string}`,
            topics: [V3_BURN_SIGNATURE],
            fromBlock: BigInt(fromBlock),
            toBlock: BigInt(toBlock),
          });

          // Process V3 mint logs
          for (const log of mintLogs) {
            const owner = log.topics[1] ? ('0x' + log.topics[1].slice(26)) : '';
            const tickLower = log.topics[2] ? parseInt(log.topics[2], 16) : 0;
            const tickUpper = log.topics[3] ? parseInt(log.topics[3], 16) : 0;

            let timestamp = Math.floor(Date.now() / 1000);
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber! });
              timestamp = Number(block.timestamp);
            } catch {}

            insertPosition({
              chain_id: chainId,
              pool_address: poolAddress,
              owner,
              tick_lower: tickLower > 0x7FFFFF ? tickLower - 0x1000000 : tickLower,
              tick_upper: tickUpper > 0x7FFFFF ? tickUpper - 0x1000000 : tickUpper,
              liquidity: '0',
              amount0: '0',
              amount1: '0',
              tx_hash: log.transactionHash || '',
              block_number: Number(log.blockNumber),
              timestamp,
              event_type: 'mint',
            });
            syncedPositions++;
          }

          // Process V3 burn logs
          for (const log of burnLogs) {
            const owner = log.topics[1] ? ('0x' + log.topics[1].slice(26)) : '';
            const tickLower = log.topics[2] ? parseInt(log.topics[2], 16) : 0;
            const tickUpper = log.topics[3] ? parseInt(log.topics[3], 16) : 0;

            let timestamp = Math.floor(Date.now() / 1000);
            try {
              const block = await client.getBlock({ blockNumber: log.blockNumber! });
              timestamp = Number(block.timestamp);
            } catch {}

            insertPosition({
              chain_id: chainId,
              pool_address: poolAddress,
              owner,
              tick_lower: tickLower > 0x7FFFFF ? tickLower - 0x1000000 : tickLower,
              tick_upper: tickUpper > 0x7FFFFF ? tickUpper - 0x1000000 : tickUpper,
              liquidity: '0',
              amount0: '0',
              amount1: '0',
              tx_hash: log.transactionHash || '',
              block_number: Number(log.blockNumber),
              timestamp,
              event_type: 'burn',
            });
            syncedPositions++;
          }
        }

        // Update progress
        const progress = Math.floor(((toBlock - startBlock) / totalBlocks) * 100);
        console.log(`Synced blocks ${fromBlock}-${toBlock} (${progress}%), ${syncedPositions} positions found`);

        if (progressCallback) {
          progressCallback(toBlock - startBlock, totalBlocks, syncedPositions);
        }

        // Update sync status periodically
        updateSyncStatus(chainId, poolAddress, toBlock, status?.pool_creation_block || undefined);

      } catch (error) {
        console.error(`Error syncing blocks ${fromBlock}-${toBlock}:`, error);
        // Continue with next range
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
      }
    }

    // Final update
    updateSyncStatus(chainId, poolAddress, currentBlock, status?.pool_creation_block || undefined);

  } finally {
    setSyncing(chainId, poolAddress, false);
  }

  return { synced: syncedPositions, total: totalBlocks };
}

// Get unique LP addresses for a pool
export function getUniqueLPs(chainId: string, poolAddress: string): string[] {
  const stmt = db.prepare(`
    SELECT DISTINCT owner FROM lp_positions
    WHERE chain_id = ? AND pool_address = ?
  `);
  const results = stmt.all(chainId, poolAddress.toLowerCase()) as { owner: string }[];
  return results.map(r => r.owner);
}

// Get positions statistics
export function getPositionStats(chainId: string, poolAddress: string) {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT owner) as unique_lps,
      SUM(CASE WHEN event_type = 'mint' THEN 1 ELSE 0 END) as mints,
      SUM(CASE WHEN event_type = 'burn' THEN 1 ELSE 0 END) as burns
    FROM lp_positions
    WHERE chain_id = ? AND pool_address = ?
  `);
  return stmt.get(chainId, poolAddress.toLowerCase()) as {
    total: number;
    unique_lps: number;
    mints: number;
    burns: number;
  };
}
