import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, encodeFunctionData, parseAbi, type Chain } from 'viem';
import { mainnet, base, arbitrum, polygon, optimism } from 'viem/chains';

// Chain configs
const CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  137: polygon,
  10: optimism,
};

// Uniswap Universal Router addresses
const UNIVERSAL_ROUTER: Record<number, `0x${string}`> = {
  1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  42161: '0x5E325eDA8064b456f4781070C0738d849c824258',
  137: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
  10: '0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8',
};

// Uniswap Quoter V2 addresses
const QUOTER_V2: Record<number, `0x${string}`> = {
  1: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  8453: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  42161: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  137: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  10: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
};

// WETH addresses per chain
const WETH: Record<number, `0x${string}`> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  10: '0x4200000000000000000000000000000000000006',
};

// Native token address placeholder
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// QuoterV2 ABI for quoteExactInputSingle
const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
]);

// Common pool fees to try
const POOL_FEES = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const chainId = parseInt(searchParams.get('chainId') || '1');
  const sellToken = searchParams.get('sellToken');
  const buyToken = searchParams.get('buyToken');
  const sellAmount = searchParams.get('sellAmount');
  const takerAddress = searchParams.get('takerAddress');
  const slippageBps = parseInt(searchParams.get('slippageBps') || '50');

  if (!sellToken || !buyToken || !sellAmount || !takerAddress) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  const chain = CHAINS[chainId];
  if (!chain) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported` },
      { status: 400 }
    );
  }

  try {
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    // Convert native token to WETH
    const tokenIn = sellToken.toLowerCase() === NATIVE_TOKEN.toLowerCase()
      ? WETH[chainId]
      : sellToken as `0x${string}`;
    const tokenOut = buyToken.toLowerCase() === NATIVE_TOKEN.toLowerCase()
      ? WETH[chainId]
      : buyToken as `0x${string}`;

    const isNativeIn = sellToken.toLowerCase() === NATIVE_TOKEN.toLowerCase();

    // Try different pool fees to find the best quote
    let bestQuote: { amountOut: bigint; fee: number; gasEstimate: bigint } | null = null;

    for (const fee of POOL_FEES) {
      try {
        const result = await client.simulateContract({
          address: QUOTER_V2[chainId],
          abi: QUOTER_ABI,
          functionName: 'quoteExactInputSingle',
          args: [{
            tokenIn,
            tokenOut,
            amountIn: BigInt(sellAmount),
            fee,
            sqrtPriceLimitX96: BigInt(0),
          }],
        });

        const [amountOut, , , gasEstimate] = result.result as [bigint, bigint, number, bigint];

        if (!bestQuote || amountOut > bestQuote.amountOut) {
          bestQuote = { amountOut, fee, gasEstimate };
        }
      } catch {
        // Pool with this fee doesn't exist or has insufficient liquidity
        continue;
      }
    }

    if (!bestQuote) {
      return NextResponse.json(
        { error: 'No liquidity available for this pair' },
        { status: 400 }
      );
    }

    // Apply slippage to minimum output
    const minAmountOut = bestQuote.amountOut * BigInt(10000 - slippageBps) / BigInt(10000);

    // Build the swap calldata for Universal Router
    // Command: V3_SWAP_EXACT_IN (0x00)
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    // Encode the path: tokenIn -> fee -> tokenOut
    const path = encodePath([tokenIn, tokenOut], [bestQuote.fee]);

    // Universal Router execute call
    const commands = isNativeIn ? '0x0b00' : '0x00'; // WRAP_ETH + V3_SWAP_EXACT_IN or just V3_SWAP_EXACT_IN

    let inputs: `0x${string}`[];
    if (isNativeIn) {
      // WRAP_ETH input
      const wrapInput = encodeAbiParameters(
        ['address', 'uint256'],
        [UNIVERSAL_ROUTER[chainId], BigInt(sellAmount)]
      );
      // V3_SWAP_EXACT_IN input
      const swapInput = encodeAbiParameters(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [takerAddress as `0x${string}`, BigInt(sellAmount), minAmountOut, path, false]
      );
      inputs = [wrapInput, swapInput];
    } else {
      // V3_SWAP_EXACT_IN input
      const swapInput = encodeAbiParameters(
        ['address', 'uint256', 'uint256', 'bytes', 'bool'],
        [takerAddress as `0x${string}`, BigInt(sellAmount), minAmountOut, path, true]
      );
      inputs = [swapInput];
    }

    // Encode execute function
    const data = encodeFunctionData({
      abi: parseAbi(['function execute(bytes commands, bytes[] inputs, uint256 deadline) external payable']),
      functionName: 'execute',
      args: [commands as `0x${string}`, inputs, BigInt(deadline)],
    });

    // Calculate price
    const price = Number(bestQuote.amountOut) / Number(sellAmount);

    return NextResponse.json({
      sellAmount,
      buyAmount: bestQuote.amountOut.toString(),
      minBuyAmount: minAmountOut.toString(),
      price: price.toString(),
      to: UNIVERSAL_ROUTER[chainId],
      data,
      value: isNativeIn ? sellAmount : '0',
      estimatedGas: (bestQuote.gasEstimate * BigInt(150) / BigInt(100)).toString(), // 50% buffer
      fee: bestQuote.fee,
      priceImpact: '0', // Would need more complex calculation
    });
  } catch (error) {
    console.error('Uniswap quote error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quote' },
      { status: 500 }
    );
  }
}

// Helper: encode path for V3 swap
function encodePath(tokens: `0x${string}`[], fees: number[]): `0x${string}` {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Invalid path');
  }

  let path = tokens[0].toLowerCase();
  for (let i = 0; i < fees.length; i++) {
    path += fees[i].toString(16).padStart(6, '0');
    path += tokens[i + 1].slice(2).toLowerCase();
  }

  return path as `0x${string}`;
}

// Helper: encode ABI parameters
function encodeAbiParameters(types: string[], values: unknown[]): `0x${string}` {
  // Simple encoding for our specific cases
  let result = '0x';

  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const value = values[i];

    if (type === 'address') {
      result += (value as string).slice(2).toLowerCase().padStart(64, '0');
    } else if (type === 'uint256') {
      result += (value as bigint).toString(16).padStart(64, '0');
    } else if (type === 'bytes') {
      const bytes = value as `0x${string}`;
      const bytesWithoutPrefix = bytes.slice(2);
      // Offset to bytes data
      const offset = types.length * 32;
      result += offset.toString(16).padStart(64, '0');
      // Will append bytes data at the end
    } else if (type === 'bool') {
      result += (value ? '1' : '0').padStart(64, '0');
    }
  }

  // Append bytes data if present
  const bytesIndex = types.indexOf('bytes');
  if (bytesIndex !== -1) {
    const bytes = values[bytesIndex] as `0x${string}`;
    const bytesWithoutPrefix = bytes.slice(2);
    const length = bytesWithoutPrefix.length / 2;
    result += length.toString(16).padStart(64, '0');
    result += bytesWithoutPrefix.padEnd(Math.ceil(bytesWithoutPrefix.length / 64) * 64, '0');
  }

  return result as `0x${string}`;
}
