import { NextRequest } from 'next/server';
import { getV4LPPositionsFromDune, getV4LPPositionsFromDb, isDuneAvailable, DuneLPPosition } from '@/lib/dune';
import { getLPPositions, LPPosition } from '@/lib/lp-positions';

// Check if it's a V4 pool ID
function isV4Pool(poolAddress: string): boolean {
  return poolAddress.length === 66;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');
  const limit = parseInt(searchParams.get('limit') || '50');

  if (!chainId || !poolAddress) {
    return new Response('Missing parameters', { status: 400 });
  }

  // Create a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const isV4 = isV4Pool(poolAddress);

        // Step 1: Starting
        send({
          status: 'loading',
          progress: 5,
          message: isV4 ? 'Checking cache...' : 'Loading V3 positions...',
        });

        let positions: LPPosition[] = [];
        let source = 'rpc';

        if (isV4) {
          // V4 pool - first try local database
          send({
            status: 'loading',
            progress: 10,
            message: 'Checking local database...',
          });

          // Try database first (fast, no API call)
          const dbPositions = await getV4LPPositionsFromDb(chainId, poolAddress, limit * 2);

          if (dbPositions && dbPositions.length > 0) {
            // Use local data
            positions = dbPositions.map(pos => ({
              owner: pos.owner,
              tickLower: pos.tickLower,
              tickUpper: pos.tickUpper,
              liquidity: pos.liquidityDelta.replace('-', ''),
              amount0: '0',
              amount1: '0',
              txHash: pos.txHash,
              blockNumber: pos.blockNumber,
              timestamp: pos.timestamp,
              type: pos.type === 'add' ? 'mint' : 'burn',
            }));
            source = 'database';
            send({
              status: 'loading',
              progress: 80,
              message: `Found ${positions.length} positions in database`,
            });
          } else if (isDuneAvailable()) {
            // No local data, fetch from Dune
            send({
              status: 'loading',
              progress: 20,
              message: 'No local data, querying Dune API...',
            });

            const dunePositions = await getV4LPPositionsFromDuneWithProgress(
              chainId,
              poolAddress,
              limit * 2,
              send
            );

            if (dunePositions && dunePositions.length > 0) {
              positions = dunePositions.map(pos => ({
                owner: pos.owner,
                tickLower: pos.tickLower,
                tickUpper: pos.tickUpper,
                liquidity: pos.liquidityDelta.replace('-', ''),
                amount0: '0',
                amount1: '0',
                txHash: pos.txHash,
                blockNumber: pos.blockNumber,
                timestamp: pos.timestamp,
                type: pos.type === 'add' ? 'mint' : 'burn',
              }));
              source = 'dune';
            }
          }
        }

        // For V4 pools without data, show message and complete with empty positions
        if (positions.length === 0 && isV4) {
          send({
            status: 'complete',
            progress: 100,
            message: 'No LP data available. Waiting for background sync.',
            data: {
              positions: [],
              stats: { total: 0, mints: 0, burns: 0, uniqueLPs: 0 },
              source: 'none',
            },
          });
          controller.close();
          return;
        } else if (positions.length === 0) {
          // V3 pools can still use RPC
          send({
            status: 'loading',
            progress: 30,
            message: 'Scanning blockchain...',
          });

          positions = await getLPPositions(chainId, poolAddress, false);
          source = 'rpc';
        }

        // Step: Processing
        send({
          status: 'loading',
          progress: 90,
          message: 'Processing results...',
        });

        // Calculate stats
        const mintCount = positions.filter(p => p.type === 'mint').length;
        const burnCount = positions.filter(p => p.type === 'burn').length;
        const uniqueOwners = new Set(positions.map(p => p.owner)).size;

        // Send final result
        send({
          status: 'complete',
          progress: 100,
          message: 'Done',
          data: {
            positions: positions.slice(0, limit),
            stats: {
              total: positions.length,
              mints: mintCount,
              burns: burnCount,
              uniqueLPs: uniqueOwners,
            },
            source,
          },
        });
      } catch (error) {
        send({
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Modified Dune query with progress updates
async function getV4LPPositionsFromDuneWithProgress(
  chainId: string,
  poolId: string,
  limit: number,
  send: (data: object) => void
): Promise<DuneLPPosition[] | null> {
  // This is a wrapper that would ideally be integrated into dune.ts
  // For now, we'll just call the regular function and simulate progress

  send({
    status: 'loading',
    progress: 30,
    message: 'Executing SQL query...',
  });

  // Small delay to show progress
  await new Promise(r => setTimeout(r, 100));

  send({
    status: 'loading',
    progress: 50,
    message: 'Waiting for Dune response...',
  });

  const result = await getV4LPPositionsFromDune(chainId, poolId, limit);

  send({
    status: 'loading',
    progress: 80,
    message: result ? 'Got data from Dune' : 'No data from Dune',
  });

  return result;
}
