import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base, mainnet, bsc, arbitrum, polygon } from 'viem/chains';

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

const ERC20_ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

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

    // For V4 pools (66 char poolId), fetch from PoolManager Swap events
    if (poolAddress.length === 66) {
      const v4Trades = await getV4Trades(chainId, poolAddress, limit);
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

// Fetch V4 trades from PoolManager Swap events
async function getV4Trades(
  chainId: string,
  poolId: string,
  limit: number
): Promise<Trade[]> {
  try {
    const chain = CHAINS[chainId];
    const rpcUrl = RPC_URLS[chainId];
    const poolManagerAddr = V4_POOL_MANAGER[chainId];

    if (!chain || !rpcUrl || !poolManagerAddr) {
      console.error('V4 not supported on chain:', chainId);
      return [];
    }

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl, { timeout: 30000 }),
    });

    // Get current block number
    const currentBlock = await client.getBlockNumber();

    // Query from last 10000 blocks (roughly a few hours depending on chain)
    const blocksToQuery = 10000n;
    const startBlock = currentBlock - blocksToQuery;

    console.log(`Fetching V4 Swap events for pool ${poolId.slice(0, 10)}... from block ${startBlock}`);

    // Fetch Swap events from PoolManager
    // Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)
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

    console.log(`Found ${logs.length} V4 Swap events`);

    if (logs.length === 0) {
      return [];
    }

    // Get block timestamps in batches
    const uniqueBlocks = [...new Set(logs.map(log => log.blockNumber))];
    const blockTimestamps = new Map<bigint, number>();

    // Fetch timestamps in parallel batches of 10
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

    // Parse events into Trade format
    // For V4 pools: amount0 is USDC (6 decimals), amount1 is the other token
    // Positive amount means tokens going INTO the pool (from swapper)
    // Negative amount means tokens going OUT of the pool (to swapper)
    const trades: Trade[] = logs.slice(-limit).map(log => {
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

      // amount0 is usually USDC (quote), amount1 is the base token (e.g., PING)
      // If amount0 > 0 (USDC going in), user is buying base token -> BUY
      // If amount0 < 0 (USDC going out), user is selling base token -> SELL
      const isBuy = args.amount0 > 0n;

      // Calculate amounts (USDC is 6 decimals, assume base token is 18 decimals for PING)
      const usdcAmount = Math.abs(Number(args.amount0)) / 1e6;
      const baseAmount = Math.abs(Number(args.amount1)) / 1e18;

      // Calculate price directly from trade amounts (more reliable than sqrtPriceX96)
      // Price = USDC amount / Token amount
      const price = baseAmount > 0 ? usdcAmount / baseAmount : 0;

      const timestamp = blockTimestamps.get(log.blockNumber) || Math.floor(Date.now() / 1000);

      return {
        txHash: log.transactionHash,
        type: isBuy ? 'buy' : 'sell',
        price: price,
        amount: baseAmount,
        volumeUsd: usdcAmount,
        timestamp: new Date(timestamp * 1000).toISOString(),
        blockNumber: Number(log.blockNumber),
      };
    });

    // Sort by block number descending (newest first) and return
    return trades.sort((a, b) => b.blockNumber - a.blockNumber);
  } catch (error) {
    console.error('Error fetching V4 trades:', error);
    return [];
  }
}
