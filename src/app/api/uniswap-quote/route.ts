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

// SwapRouter02 addresses per chain
const SWAP_ROUTER_02: Record<number, `0x${string}`> = {
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  8453: '0x2626664c2603336E57B271c5C0b26F421741e481',
  42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  137: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
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

// SwapRouter02 ABI - note: includes deadline in the struct for this version
const SWAP_ROUTER_ABI = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) external payable',
  'function refundETH() external payable',
]);

// Common pool fees to try
const POOL_FEES = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

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

    // Build the swap calldata for SwapRouter02
    // IMPORTANT: Always use multicall to set deadline properly
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    const multicallData: `0x${string}`[] = [];

    if (isNativeIn) {
      // ETH -> Token
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn: WETH[chainId],
          tokenOut,
          fee: bestQuote.fee,
          recipient: takerAddress as `0x${string}`,
          amountIn: BigInt(sellAmount),
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: BigInt(0),
        }],
      });
      multicallData.push(swapCalldata);

      // Refund excess ETH
      const refundCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'refundETH',
        args: [],
      });
      multicallData.push(refundCalldata);
    } else if (isNativeOut) {
      // Token -> ETH
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn,
          tokenOut: WETH[chainId],
          fee: bestQuote.fee,
          recipient: SWAP_ROUTER_02[chainId], // Send WETH to router first
          amountIn: BigInt(sellAmount),
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: BigInt(0),
        }],
      });
      multicallData.push(swapCalldata);

      // Unwrap WETH to ETH
      const unwrapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'unwrapWETH9',
        args: [minAmountOut, takerAddress as `0x${string}`],
      });
      multicallData.push(unwrapCalldata);
    } else if (bestQuote.isMultiHop && bestQuote.hopFees) {
      // Token -> Token via WETH
      const path = encodePath([tokenIn, weth, tokenOut], bestQuote.hopFees);
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInput',
        args: [{
          path,
          recipient: takerAddress as `0x${string}`,
          amountIn: BigInt(sellAmount),
          amountOutMinimum: minAmountOut,
        }],
      });
      multicallData.push(swapCalldata);
    } else {
      // Token -> Token direct
      const swapCalldata = encodeFunctionData({
        abi: SWAP_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [{
          tokenIn,
          tokenOut,
          fee: bestQuote.fee,
          recipient: takerAddress as `0x${string}`,
          amountIn: BigInt(sellAmount),
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: BigInt(0),
        }],
      });
      multicallData.push(swapCalldata);
    }

    // Wrap in multicall with deadline
    const data = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: 'multicall',
      args: [BigInt(deadline), multicallData],
    });

    // Calculate price
    const price = Number(bestQuote.amountOut) / Number(sellAmount);

    return NextResponse.json({
      sellAmount,
      buyAmount: bestQuote.amountOut.toString(),
      minBuyAmount: minAmountOut.toString(),
      price: price.toString(),
      to: SWAP_ROUTER_02[chainId],
      data,
      value: isNativeIn ? sellAmount : '0',
      estimatedGas: (bestQuote.gasEstimate * BigInt(150) / BigInt(100)).toString(),
      fee: bestQuote.fee,
      priceImpact: '0',
      isMultiHop: bestQuote.isMultiHop,
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

  let path = tokens[0].slice(2);

  for (let i = 0; i < fees.length; i++) {
    const feeHex = ('000000' + fees[i].toString(16)).slice(-6);
    path += feeHex + tokens[i + 1].slice(2);
  }

  return `0x${path}` as `0x${string}`;
}
