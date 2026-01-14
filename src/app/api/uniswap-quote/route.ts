import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, encodeFunctionData, parseAbi, encodeAbiParameters, type Chain } from 'viem';
import { mainnet, base, arbitrum, polygon, optimism } from 'viem/chains';

// Chain configs
const CHAINS: Record<number, Chain> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  137: polygon,
  10: optimism,
};

// Universal Router addresses per chain
const UNIVERSAL_ROUTER: Record<number, `0x${string}`> = {
  1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  42161: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  137: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  10: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
};

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS: `0x${string}` = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

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
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  10: '0x4200000000000000000000000000000000000006',
};

// Native token address placeholder
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// QuoterV2 ABI
const QUOTER_ABI = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
  'function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut, uint160[] sqrtPriceX96AfterList, uint32[] initializedTicksCrossedList, uint256 gasEstimate)',
]);

// Common pool fees to try
const POOL_FEES = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

// Universal Router command codes
const Commands = {
  V3_SWAP_EXACT_IN: 0x00,
  V3_SWAP_EXACT_OUT: 0x01,
  PERMIT2_TRANSFER_FROM: 0x02,
  PERMIT2_PERMIT_BATCH: 0x03,
  SWEEP: 0x04,
  TRANSFER: 0x05,
  PAY_PORTION: 0x06,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
  PERMIT2_TRANSFER_FROM_BATCH: 0x0d,
};

// Universal Router ABI
const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
]);

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

    // Check if dealing with native token
    const isNativeIn = sellToken.toLowerCase() === NATIVE_TOKEN.toLowerCase();
    const isNativeOut = buyToken.toLowerCase() === NATIVE_TOKEN.toLowerCase();

    // Convert native token to WETH for quoting
    const tokenIn = isNativeIn ? WETH[chainId] : sellToken as `0x${string}`;
    const tokenOut = isNativeOut ? WETH[chainId] : buyToken as `0x${string}`;

    // Try different pool fees to find the best quote
    let bestQuote: {
      amountOut: bigint;
      fee: number;
      gasEstimate: bigint;
      isMultiHop: boolean;
      hopFees?: [number, number];
    } | null = null;

    const weth = WETH[chainId];
    const isWethInvolved = tokenIn.toLowerCase() === weth.toLowerCase() || tokenOut.toLowerCase() === weth.toLowerCase();

    // Try direct path first
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
          bestQuote = { amountOut, fee, gasEstimate, isMultiHop: false };
        }
      } catch {
        continue;
      }
    }

    // If no direct path found and WETH is not already involved, try multi-hop through WETH
    if (!bestQuote && !isWethInvolved) {
      for (const fee1 of POOL_FEES) {
        for (const fee2 of POOL_FEES) {
          try {
            const path = encodePath([tokenIn, weth, tokenOut], [fee1, fee2]);

            const result = await client.simulateContract({
              address: QUOTER_V2[chainId],
              abi: QUOTER_ABI,
              functionName: 'quoteExactInput',
              args: [path, BigInt(sellAmount)],
            });

            const [amountOut, , , gasEstimate] = result.result as [bigint, bigint[], number[], bigint];

            if (!bestQuote || amountOut > bestQuote.amountOut) {
              bestQuote = { amountOut, fee: fee1, gasEstimate, isMultiHop: true, hopFees: [fee1, fee2] };
            }
          } catch {
            continue;
          }
        }
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

    // Build Universal Router calldata
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    let commands: number[] = [];
    let inputs: `0x${string}`[] = [];

    if (isNativeIn) {
      // ETH -> Token: WRAP_ETH + V3_SWAP_EXACT_IN
      commands = [Commands.WRAP_ETH, Commands.V3_SWAP_EXACT_IN];

      // WRAP_ETH: recipient (address), amountMin (uint256)
      // For WRAP_ETH, recipient should be the router address (it wraps ETH to WETH held by router)
      const wrapInput = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [UNIVERSAL_ROUTER[chainId], BigInt(sellAmount)]
      );
      inputs.push(wrapInput);

      // V3_SWAP_EXACT_IN: recipient, amountIn, amountOutMin, path, payerIsUser
      const path = bestQuote.isMultiHop && bestQuote.hopFees
        ? encodePath([weth, weth, tokenOut], bestQuote.hopFees)
        : encodePath([weth, tokenOut], [bestQuote.fee]);

      const swapInput = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }, { type: 'bool' }],
        [takerAddress as `0x${string}`, BigInt(sellAmount), minAmountOut, path, false] // payerIsUser = false (router pays)
      );
      inputs.push(swapInput);

    } else if (isNativeOut) {
      // Token -> ETH: V3_SWAP_EXACT_IN + UNWRAP_WETH
      commands = [Commands.V3_SWAP_EXACT_IN, Commands.UNWRAP_WETH];

      // V3_SWAP_EXACT_IN to router (to unwrap)
      const path = bestQuote.isMultiHop && bestQuote.hopFees
        ? encodePath([tokenIn, weth, weth], bestQuote.hopFees)
        : encodePath([tokenIn, weth], [bestQuote.fee]);

      // ADDRESS_THIS (0x0000000000000000000000000000000000000002) = send to router
      const ADDRESS_THIS = '0x0000000000000000000000000000000000000002' as `0x${string}`;
      const swapInput = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }, { type: 'bool' }],
        [ADDRESS_THIS, BigInt(sellAmount), minAmountOut, path, true] // payerIsUser = true
      );
      inputs.push(swapInput);

      // UNWRAP_WETH: recipient, amountMin
      const unwrapInput = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [takerAddress as `0x${string}`, minAmountOut]
      );
      inputs.push(unwrapInput);

    } else {
      // Token -> Token: just V3_SWAP_EXACT_IN
      commands = [Commands.V3_SWAP_EXACT_IN];

      const path = bestQuote.isMultiHop && bestQuote.hopFees
        ? encodePath([tokenIn, weth, tokenOut], bestQuote.hopFees)
        : encodePath([tokenIn, tokenOut], [bestQuote.fee]);

      // MSG_SENDER (0x0000000000000000000000000000000000000001) could also be used, but explicit address is clearer
      const swapInput = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'bytes' }, { type: 'bool' }],
        [takerAddress as `0x${string}`, BigInt(sellAmount), minAmountOut, path, true] // payerIsUser = true
      );
      inputs.push(swapInput);
    }

    // Encode execute function call
    const commandsHex = `0x${commands.map(c => c.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

    const data = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: [commandsHex, inputs, BigInt(deadline)],
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
      estimatedGas: (bestQuote.gasEstimate * BigInt(150) / BigInt(100)).toString(),
      fee: bestQuote.fee,
      priceImpact: '0',
      isMultiHop: bestQuote.isMultiHop,
      // Info for frontend - need Permit2 approval for token transfers
      permit2Address: PERMIT2_ADDRESS,
      needsPermit2: !isNativeIn,
      universalRouter: UNIVERSAL_ROUTER[chainId],
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

  let path = tokens[0].slice(2).toLowerCase();

  for (let i = 0; i < fees.length; i++) {
    const feeHex = ('000000' + fees[i].toString(16)).slice(-6);
    path += feeHex + tokens[i + 1].slice(2).toLowerCase();
  }

  return `0x${path}` as `0x${string}`;
}
