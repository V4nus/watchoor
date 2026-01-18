'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Code2,
  Zap,
  Shield,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Terminal,
  Wallet,
  ArrowRight,
} from 'lucide-react';

export default function X402Page() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const apis = [
    {
      id: 'orderbook',
      name: 'Order Book API',
      description: 'Real-time bid/ask liquidity depth data for any supported pool. Get precise price levels and token amounts.',
      price: '$0.01',
      priceUnits: '10000',
      endpoint: '/api/x402/orderbook',
      method: 'GET',
      features: ['Real-time data', 'Multi-chain support', 'V2/V3/V4 pools'],
      params: [
        { name: 'chainId', type: 'string', required: true, description: 'Chain identifier (base, ethereum, solana)' },
        { name: 'poolAddress', type: 'string', required: true, description: 'Pool contract address' },
      ],
      example: `curl -X GET "https://watchoor.vercel.app/api/x402/orderbook?chainId=base&poolAddress=0x..." \\
  -H "X-Payment: <payment-header>"`,
      responsePreview: {
        bids: [
          { price: 0.00395, tokenAmount: 18987341.5, liquidityUSD: 74997 },
          { price: 0.00390, tokenAmount: 12500000, liquidityUSD: 48750 }
        ],
        asks: [
          { price: 0.00405, tokenAmount: 2750617.3, liquidityUSD: 11136 },
          { price: 0.00410, tokenAmount: 5000000, liquidityUSD: 20500 }
        ],
        stats: {
          totalBidLiquidity: 74997,
          totalAskLiquidity: 453187,
          spread: 0.0001,
          midPrice: 0.004
        }
      }
    },
    {
      id: 'liquidity-depth',
      name: 'Liquidity Depth API',
      description: 'Cumulative liquidity curves with price impact analysis. Essential for optimal trade execution and slippage estimation.',
      price: '$0.02',
      priceUnits: '20000',
      endpoint: '/api/x402/liquidity-depth',
      method: 'GET',
      features: ['Cumulative curves', 'Price impact %', 'Depth metrics'],
      params: [
        { name: 'chainId', type: 'string', required: true, description: 'Chain identifier (base, ethereum, solana)' },
        { name: 'poolAddress', type: 'string', required: true, description: 'Pool contract address' },
      ],
      example: `curl -X GET "https://watchoor.vercel.app/api/x402/liquidity-depth?chainId=base&poolAddress=0x..." \\
  -H "X-Payment: <payment-header>"`,
      responsePreview: {
        bidCurve: [
          { price: 0.00395, cumulativeLiquidityUSD: 74997, priceImpactPercent: 1.2 },
          { price: 0.00385, cumulativeLiquidityUSD: 150000, priceImpactPercent: 2.5 }
        ],
        askCurve: [
          { price: 0.00405, cumulativeLiquidityUSD: 11136, priceImpactPercent: 1.5 },
          { price: 0.00415, cumulativeLiquidityUSD: 45000, priceImpactPercent: 3.0 }
        ],
        stats: {
          liquidityAt1PercentBid: 25000,
          liquidityAt5PercentBid: 120000,
          liquidityAt1PercentAsk: 15000,
          liquidityAt5PercentAsk: 80000
        }
      }
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-[#111]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Watchoor</span>
            </Link>
            <a
              href="https://www.x402scan.com/server/8e75c141-e921-45ec-81e2-b53dd534c2ef"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors"
            >
              <span className="text-sm font-medium">View on x402scan</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <section className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/5 mb-6">
            <Code2 size={16} className="text-[#22c55e]" />
            <span className="text-sm text-[#22c55e]">x402 Protocol</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6">
            Liquidity Data <span className="text-[#22c55e]">API</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-3xl mx-auto mb-8">
            Pay-per-request APIs powered by the x402 protocol. No subscriptions, no API keys,
            no sign-ups. Just send a payment header with USDC on Base and get instant access to
            real-time DEX liquidity data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://www.x402.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#22c55e] hover:bg-[#1ea84b] text-black font-medium transition-colors"
            >
              <BookOpen size={18} />
              Learn x402 Protocol
            </a>
            <a
              href="#apis"
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#333] hover:border-[#22c55e]/50 text-white transition-colors"
            >
              <Terminal size={18} />
              View API Docs
            </a>
          </div>
        </section>

        {/* What is x402 */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8">What is x402?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8">
              <p className="text-gray-300 leading-relaxed mb-6">
                x402 is a new HTTP-native payment protocol that enables machine-to-machine payments.
                It extends the HTTP 402 &quot;Payment Required&quot; status code to create a standardized
                way for APIs to request and receive payments.
              </p>
              <p className="text-gray-400 leading-relaxed">
                When you call a x402-enabled API without payment, you receive a 402 response with
                payment instructions. Send the payment on-chain (USDC on Base), include the receipt
                in your next request, and get your data. Simple as that.
              </p>
            </div>
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8">
              <h3 className="font-medium mb-4 text-[#22c55e]">Perfect for AI Agents</h3>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-2" />
                  <span>Autonomous payments without human intervention</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-2" />
                  <span>Pay only for what you use - no monthly minimums</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-2" />
                  <span>Cryptographic proof of payment in each request</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] mt-2" />
                  <span>No API keys to manage or rotate</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Payment Info */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8">Payment Details</h2>
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div>
                <div className="text-sm text-gray-500 mb-1">Network</div>
                <div className="flex items-center gap-2">
                  <img src="/chains/base.svg" alt="Base" className="w-5 h-5" />
                  <span className="font-medium">Base (EIP-155:8453)</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Currency</div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">$</div>
                  <span className="font-medium">USDC</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Pay To</div>
                <code className="text-xs text-[#22c55e] font-mono break-all">
                  0x0C019f363765FcA8077BAe7327fD937c1a5d71B3
                </code>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Protocol</div>
                <span className="font-medium">x402 v2</span>
              </div>
            </div>

            {/* Facilitator */}
            <div className="pt-6 border-t border-[#1a1a1a]">
              <div className="text-sm text-gray-500 mb-3">Supported Facilitator</div>
              <a
                href="https://payai.network"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111] border border-[#222] hover:border-[#22c55e]/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                  P
                </div>
                <div>
                  <div className="font-medium group-hover:text-[#22c55e] transition-colors">PayAI Network</div>
                  <div className="text-xs text-gray-500">x402 Facilitator · Base & Solana</div>
                </div>
                <ExternalLink size={14} className="text-gray-500 group-hover:text-[#22c55e] transition-colors ml-2" />
              </a>
              <p className="text-xs text-gray-500 mt-3">
                PayAI handles payment verification and settlement for AI agents.{' '}
                <a href="https://docs.payai.network/x402/introduction" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline">
                  View docs →
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* API Endpoints */}
        <section id="apis" className="mb-20">
          <h2 className="text-2xl font-bold mb-8">API Endpoints</h2>
          <div className="space-y-8">
            {apis.map((api) => (
              <div
                key={api.id}
                className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-[#1a1a1a]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{api.name}</h3>
                      <p className="text-gray-400">{api.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/20">
                        <span className="text-[#22c55e] font-mono font-medium">{api.price}</span>
                        <span className="text-gray-500 text-sm ml-1">/req</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                        <span className="text-blue-400 font-mono text-sm">{api.method}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {api.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-2.5 py-1 rounded-md bg-[#111] text-xs text-gray-400"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Endpoint */}
                <div className="p-6 border-b border-[#1a1a1a] bg-[#080808]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Endpoint</span>
                    <button
                      onClick={() => copyToClipboard(`https://watchoor.vercel.app${api.endpoint}`, `${api.id}-endpoint`)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#22c55e] transition-colors"
                    >
                      {copiedEndpoint === `${api.id}-endpoint` ? (
                        <>
                          <Check size={12} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <code className="text-[#22c55e] font-mono">
                    https://watchoor.vercel.app{api.endpoint}
                  </code>
                </div>

                {/* Parameters */}
                <div className="p-6 border-b border-[#1a1a1a]">
                  <span className="text-xs text-gray-500 uppercase tracking-wider block mb-4">Parameters</span>
                  <div className="space-y-3">
                    {api.params.map((param) => (
                      <div key={param.name} className="flex items-start gap-4">
                        <code className="text-sm text-[#22c55e] font-mono min-w-[120px]">{param.name}</code>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-[#111] text-gray-500">{param.type}</span>
                          {param.required && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">required</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">{param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example */}
                <div className="p-6 border-b border-[#1a1a1a] bg-[#080808]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Example Request</span>
                    <button
                      onClick={() => copyToClipboard(api.example, `${api.id}-example`)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#22c55e] transition-colors"
                    >
                      {copiedEndpoint === `${api.id}-example` ? (
                        <>
                          <Check size={12} />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    {api.example}
                  </pre>
                </div>

                {/* Response */}
                <div className="p-6">
                  <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Response Example</span>
                  <pre className="text-sm text-gray-400 font-mono overflow-x-auto bg-[#080808] rounded-lg p-4">
                    {JSON.stringify(api.responsePreview, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it Works */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: 1, icon: Terminal, title: 'Make Request', desc: 'Call the API endpoint without payment' },
              { step: 2, icon: Wallet, title: 'Get 402', desc: 'Receive payment instructions in response' },
              { step: 3, icon: Zap, title: 'Pay on Base', desc: 'Send USDC payment on Base network' },
              { step: 4, icon: Check, title: 'Get Data', desc: 'Include receipt header, receive data' },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 h-full">
                  <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center mb-4">
                    <span className="text-[#22c55e] font-bold">{item.step}</span>
                  </div>
                  <item.icon size={24} className="text-[#22c55e] mb-3" />
                  <h3 className="font-medium mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                {item.step < 4 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-3 text-gray-600" size={20} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold mb-8">Why x402?</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="p-2 rounded-lg bg-[#22c55e]/10">
                <Zap size={20} className="text-[#22c55e]" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Instant Access</h4>
                <p className="text-sm text-gray-500">No signup required. Pay with USDC on Base and get data immediately.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="p-2 rounded-lg bg-[#22c55e]/10">
                <Shield size={20} className="text-[#22c55e]" />
              </div>
              <div>
                <h4 className="font-medium mb-1">No API Keys</h4>
                <p className="text-sm text-gray-500">x402 protocol handles auth. Your payment is your access token.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
              <div className="p-2 rounded-lg bg-[#22c55e]/10">
                <Code2 size={20} className="text-[#22c55e]" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Simple Integration</h4>
                <p className="text-sm text-gray-500">Standard REST API. Works with any HTTP client that supports x402.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-16 border-t border-[#111]">
          <h2 className="text-3xl font-bold mb-4">Ready to integrate?</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Start using our liquidity APIs today. No signup, no API keys - just pay and get data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://www.x402scan.com/server/8e75c141-e921-45ec-81e2-b53dd534c2ef"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#22c55e] hover:bg-[#1ea84b] text-black font-medium transition-colors"
            >
              View on x402scan
              <ExternalLink size={18} />
            </a>
            <a
              href="https://www.x402.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-full border border-[#333] hover:border-[#22c55e]/50 text-white transition-colors"
            >
              Learn x402 Protocol
              <ExternalLink size={18} />
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-6">
            Powered by Coinbase x402 Protocol · Payments on Base Network
          </p>
        </section>
      </main>
    </div>
  );
}
