import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

// ERC20 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Known token addresses on Base
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '0xd85c31854c2b0fb40aaa9e2fc4da23c21f829d46': { symbol: 'PING', decimals: 18 },
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18 },
};

// RPC client
const client = createPublicClient({
  chain: base,
  transport: http('https://base-rpc.publicnode.com', { timeout: 30000 }),
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const txHash = searchParams.get('txHash');

  if (!txHash) {
    return NextResponse.json({ error: 'Missing txHash parameter' }, { status: 400 });
  }

  try {
    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Parse Transfer events
    const transfers: Array<{
      token: string;
      symbol: string;
      from: string;
      to: string;
      amount: string;
      amountFormatted: string;
    }> = [];

    for (const log of receipt.logs) {
      // Check if this is a Transfer event
      if (log.topics[0] === TRANSFER_EVENT_SIGNATURE && log.topics.length >= 3) {
        const tokenAddress = log.address.toLowerCase();
        const from = '0x' + log.topics[1]?.slice(26);
        const to = '0x' + log.topics[2]?.slice(26);

        // Parse amount from data (skip if empty - NFT transfers have tokenId in topics)
        const amountHex = log.data;
        if (!amountHex || amountHex === '0x' || amountHex.length < 4) {
          continue; // Skip NFT transfers or empty data
        }

        let amount: bigint;
        try {
          amount = BigInt(amountHex);
        } catch {
          continue; // Skip if can't parse
        }

        // Get token info
        const tokenInfo = KNOWN_TOKENS[tokenAddress] || { symbol: 'UNKNOWN', decimals: 18 };

        // Format amount
        const divisor = BigInt(10 ** tokenInfo.decimals);
        const wholePart = amount / divisor;
        const fractionalPart = amount % divisor;
        const fractionalStr = fractionalPart.toString().padStart(tokenInfo.decimals, '0');
        const amountFormatted = `${wholePart}.${fractionalStr.slice(0, 6)}`;

        transfers.push({
          token: tokenAddress,
          symbol: tokenInfo.symbol,
          from,
          to,
          amount: amount.toString(),
          amountFormatted: parseFloat(amountFormatted).toString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
      transfers,
    });
  } catch (error) {
    console.error('Error fetching tx amounts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
