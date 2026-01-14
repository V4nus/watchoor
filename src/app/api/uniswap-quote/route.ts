import { NextRequest, NextResponse } from 'next/server';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import { SwapRouter } from '@uniswap/universal-router-sdk';
import { ethers } from 'ethers';

// Chain configs with RPC URLs
const CHAIN_CONFIG: Record<number, { name: string; rpcUrl: string }> = {
  1: {
    name: 'mainnet',
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com'
  },
  8453: {
    name: 'base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org'
  },
  42161: {
    name: 'arbitrum',
    rpcUrl: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc'
  },
  137: {
    name: 'polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
  },
  10: {
    name: 'optimism',
    rpcUrl: process.env.OP_RPC_URL || 'https://mainnet.optimism.io'
  },
};

// Universal Router addresses per chain
const UNIVERSAL_ROUTER: Record<number, string> = {
  1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  8453: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  42161: '0x5E325eDA8064b456f4781070C0738d849c824258',
  137: '0xec7BE89e9d109e7e3Fec59c222CF297125FEFda2',
  10: '0xCb1355ff08Ab38bBCE60111F1bb2B784bE25D7e8',
};

// Permit2 addresses (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// WETH addresses per chain (for native token handling)
const WETH: Record<number, string> = {
  1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  8453: '0x4200000000000000000000000000000000000006',
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  10: '0x4200000000000000000000000000000000000006',
};

// Native token address placeholder
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Cache for routers to avoid recreating them
const routerCache: Record<number, AlphaRouter> = {};

function getRouter(chainId: number): AlphaRouter {
  if (!routerCache[chainId]) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) throw new Error(`Chain ${chainId} not supported`);

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    routerCache[chainId] = new AlphaRouter({
      chainId,
      provider: provider as any,
    });
  }
  return routerCache[chainId];
}

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

  const config = CHAIN_CONFIG[chainId];
  if (!config) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported` },
      { status: 400 }
    );
  }

  try {
    // Check if dealing with native token
    const isNativeIn = sellToken.toLowerCase() === NATIVE_TOKEN.toLowerCase();
    const isNativeOut = buyToken.toLowerCase() === NATIVE_TOKEN.toLowerCase();

    // Convert native token to WETH for routing
    const tokenInAddress = isNativeIn ? WETH[chainId] : sellToken;
    const tokenOutAddress = isNativeOut ? WETH[chainId] : buyToken;

    // Get token decimals
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const erc20Abi = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)'];

    const tokenInContract = new ethers.Contract(tokenInAddress, erc20Abi, provider);
    const tokenOutContract = new ethers.Contract(tokenOutAddress, erc20Abi, provider);

    const [tokenInDecimals, tokenOutDecimals, tokenInSymbol, tokenOutSymbol] = await Promise.all([
      tokenInContract.decimals(),
      tokenOutContract.decimals(),
      tokenInContract.symbol().catch(() => 'TOKEN'),
      tokenOutContract.symbol().catch(() => 'TOKEN'),
    ]);

    // Create Token instances
    const tokenIn = new Token(
      chainId,
      tokenInAddress as `0x${string}`,
      Number(tokenInDecimals),
      tokenInSymbol
    );
    const tokenOut = new Token(
      chainId,
      tokenOutAddress as `0x${string}`,
      Number(tokenOutDecimals),
      tokenOutSymbol
    );

    // Create CurrencyAmount for input
    const amountIn = CurrencyAmount.fromRawAmount(tokenIn, sellAmount);

    // Get router and find best route using AlphaRouter (Smart Order Router)
    const router = getRouter(chainId);
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

    const route = await router.route(
      amountIn,
      tokenOut,
      TradeType.EXACT_INPUT,
      {
        recipient: takerAddress,
        slippageTolerance: new Percent(slippageBps, 10000),
        deadline,
        type: SwapType.UNIVERSAL_ROUTER, // Use Universal Router
      }
    );

    if (!route || !route.methodParameters) {
      return NextResponse.json(
        { error: 'No route found for this pair' },
        { status: 400 }
      );
    }

    // Get the quote amount
    const buyAmount = route.quote.quotient.toString();
    const price = Number(buyAmount) / Number(sellAmount);

    // Calculate minimum output with slippage
    const minBuyAmount = (BigInt(buyAmount) * BigInt(10000 - slippageBps) / BigInt(10000)).toString();

    // Build route description
    const routeDescription = route.route
      .map(r => r.tokenPath.map(t => t.symbol || t.address.slice(0, 6)).join(' → '))
      .join(' | ');

    return NextResponse.json({
      sellAmount,
      buyAmount,
      minBuyAmount,
      price: price.toString(),
      to: route.methodParameters.to,
      data: route.methodParameters.calldata,
      value: isNativeIn ? sellAmount : '0',
      estimatedGas: route.estimatedGasUsed.toString(),
      priceImpact: route.trade?.priceImpact?.toFixed(2) || '0',
      route: routeDescription,
      // For approval - user needs to approve Permit2, not the router directly
      permit2Address: PERMIT2_ADDRESS,
      universalRouterAddress: UNIVERSAL_ROUTER[chainId],
    });
  } catch (error) {
    console.error('Uniswap Universal Router error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quote' },
      { status: 500 }
    );
  }
}
