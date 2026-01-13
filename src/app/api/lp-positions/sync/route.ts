import { NextRequest, NextResponse } from 'next/server';
import { syncAllV4LPPositionsFromDune, isDuneAvailable } from '@/lib/dune';

// Check if it's a V4 pool ID (66 chars with 0x prefix)
function isV4Pool(poolAddress: string): boolean {
  return poolAddress.length === 66;
}

/**
 * POST /api/lp-positions/sync
 * Sync all LP positions for a V4 pool from Dune to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, poolAddress } = body;

    if (!chainId || !poolAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing chainId or poolAddress' },
        { status: 400 }
      );
    }

    if (!isV4Pool(poolAddress)) {
      return NextResponse.json(
        { success: false, error: 'Only V4 pools (66 char ID) are supported' },
        { status: 400 }
      );
    }

    if (!isDuneAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Dune API key not configured' },
        { status: 500 }
      );
    }

    console.log(`[Sync API] Starting full sync for pool ${poolAddress.slice(0, 18)}...`);

    const result = await syncAllV4LPPositionsFromDune(chainId, poolAddress);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Synced ${result.count} LP positions from Dune`,
        count: result.count,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Sync API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lp-positions/sync/stream
 * Stream sync progress via SSE
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainId = searchParams.get('chainId');
  const poolAddress = searchParams.get('poolAddress');

  if (!chainId || !poolAddress) {
    return new Response('Missing parameters', { status: 400 });
  }

  if (!isV4Pool(poolAddress)) {
    return new Response('Only V4 pools supported', { status: 400 });
  }

  if (!isDuneAvailable()) {
    return new Response('Dune API not configured', { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ status: 'starting', message: 'Starting Dune sync...' });

        const result = await syncAllV4LPPositionsFromDune(
          chainId,
          poolAddress,
          (message, count) => {
            send({ status: 'progress', message, count });
          }
        );

        if (result.success) {
          send({
            status: 'complete',
            message: `Synced ${result.count} LP positions`,
            count: result.count,
          });
        } else {
          send({
            status: 'error',
            message: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        send({
          status: 'error',
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
