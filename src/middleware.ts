import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// x402 配置 - 直接在 middleware 中定义以避免 edge runtime 问题
const X402_PAY_TO_ADDRESS = process.env.X402_PAY_TO_ADDRESS || '0x0000000000000000000000000000000000000000';
// 直接使用 Base Mainnet，避免环境变量问题
const X402_NETWORK = 'eip155:8453';

// USDC on Base
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// API 定价和 Bazaar 扩展配置 (以 USDC 最小单位，6位小数)
const PRICING = {
  '/api/x402/orderbook': {
    amount: '10000', // $0.01 = 10000 units (6 decimals)
    description: 'Order Book API - Real-time bid/ask liquidity depth data for DEX pools',
    bazaar: {
      discoverable: true,
      category: 'defi',
      tags: ['orderbook', 'liquidity', 'dex', 'trading'],
      info: {
        input: {
          type: 'http',
          method: 'GET',
          queryParams: {
            chainId: 'base',
            poolAddress: '0x...',
          },
        },
        output: {
          type: 'json',
          example: {
            bids: [{ price: 0.00395, tokenAmount: 18987341.5, liquidityUSD: 74997 }],
            asks: [{ price: 0.00405, tokenAmount: 2750617.3, liquidityUSD: 11136 }],
            stats: { totalBidLiquidity: 74997, totalAskLiquidity: 453187, spread: 0.0001 },
          },
        },
      },
      schema: {
        input: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: 'Chain identifier (e.g., base, ethereum, solana)' },
            poolAddress: { type: 'string', description: 'Pool contract address' },
          },
          required: ['chainId', 'poolAddress'],
        },
        output: {
          type: 'object',
          properties: {
            bids: { type: 'array', description: 'Bid orders sorted by price descending' },
            asks: { type: 'array', description: 'Ask orders sorted by price ascending' },
            stats: { type: 'object', description: 'Aggregated statistics' },
          },
        },
      },
    },
  },
  '/api/x402/liquidity-depth': {
    amount: '20000', // $0.02 = 20000 units (6 decimals)
    description: 'Liquidity Depth API - Cumulative liquidity curves with price impact analysis',
    bazaar: {
      discoverable: true,
      category: 'defi',
      tags: ['liquidity', 'depth', 'price-impact', 'dex'],
      info: {
        input: {
          type: 'http',
          method: 'GET',
          queryParams: {
            chainId: 'base',
            poolAddress: '0x...',
          },
        },
        output: {
          type: 'json',
          example: {
            bidCurve: [{ price: 0.00395, cumulativeLiquidityUSD: 74997, priceImpactPercent: 1.2 }],
            askCurve: [{ price: 0.00405, cumulativeLiquidityUSD: 11136, priceImpactPercent: 1.5 }],
            stats: { liquidityAt1PercentBid: 25000, liquidityAt5PercentBid: 120000 },
          },
        },
      },
      schema: {
        input: {
          type: 'object',
          properties: {
            chainId: { type: 'string', description: 'Chain identifier (e.g., base, ethereum, solana)' },
            poolAddress: { type: 'string', description: 'Pool contract address' },
          },
          required: ['chainId', 'poolAddress'],
        },
        output: {
          type: 'object',
          properties: {
            bidCurve: { type: 'array', description: 'Cumulative bid liquidity curve' },
            askCurve: { type: 'array', description: 'Cumulative ask liquidity curve' },
            stats: { type: 'object', description: 'Depth statistics at various price impact levels' },
          },
        },
      },
    },
  },
};

function isX402Configured(): boolean {
  return X402_PAY_TO_ADDRESS !== '0x0000000000000000000000000000000000000000';
}

// 创建 402 Payment Required 响应 (带 Bazaar 扩展)
function createPaymentRequiredResponse(path: string, baseUrl: string) {
  const pricing = PRICING[path as keyof typeof PRICING];
  if (!pricing) return null;

  const fullUrl = `${baseUrl}${path}`;

  const paymentRequired = {
    x402Version: 2,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK,
        amount: pricing.amount,
        asset: `eip155:8453/erc20:${USDC_ADDRESS}`,
        payTo: X402_PAY_TO_ADDRESS,
        maxTimeoutSeconds: 300,
        extra: {},
      },
    ],
    resource: {
      url: fullUrl,
      description: pricing.description,
      mimeType: 'application/json',
    },
    // Bazaar 扩展 - 用于 x402scan 发现和 UI 展示
    extensions: {
      bazaar: pricing.bazaar,
    },
  };

  return new NextResponse(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Required': 'true',
    },
  });
}

// 验证支付头 (简化版 - 生产环境应该调用 facilitator 验证)
function hasValidPayment(request: NextRequest): boolean {
  const paymentHeader = request.headers.get('payment-signature') || request.headers.get('x-payment');
  // 如果有支付头，暂时假设有效（实际应该验证）
  return !!paymentHeader;
}

// 导出中间件
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log('[x402 Middleware] Processing:', pathname);

  // 只对 /api/x402/ 路由应用支付验证
  if (pathname.startsWith('/api/x402/')) {
    console.log('[x402 Middleware] x402 route detected');
    // 如果未配置，返回错误
    if (!isX402Configured()) {
      return NextResponse.json(
        {
          error: 'Payment system not configured',
          message: 'x402 payment is not available on this server',
        },
        { status: 503 }
      );
    }

    // 检查是否有有效支付
    if (!hasValidPayment(request)) {
      // 构建基础 URL
      const protocol = request.headers.get('x-forwarded-proto') || 'https';
      const host = request.headers.get('host') || 'watchoor.vercel.app';
      const baseUrl = `${protocol}://${host}`;

      // 返回 402 Payment Required
      const paymentResponse = createPaymentRequiredResponse(pathname, baseUrl);
      if (paymentResponse) {
        return paymentResponse;
      }
    }

    // 有支付或不需要支付的路由，继续处理
    return NextResponse.next();
  }

  // 其他路由直接通过
  return NextResponse.next();
}

// 配置中间件匹配的路由
export const config = {
  matcher: [
    // 匹配所有 API 路由以便调试
    '/api/:path*',
  ],
};
