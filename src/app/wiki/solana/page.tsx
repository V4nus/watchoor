'use client';

import Link from 'next/link';
import { ArrowLeft, Waves } from 'lucide-react';

export default function SolanaWikiPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/wiki" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm">返回文档</span>
          </Link>
          <span className="text-gray-600">|</span>
          <h1 className="text-lg font-medium flex items-center gap-2">
            <Waves className="text-[#22c55e]" size={20} />
            Solana 解析原理
          </h1>
        </div>
      </header>

      <main className="pt-20 pb-16 px-6 max-w-4xl mx-auto">
        <p className="text-gray-400 mb-8">
          Solana 上有多种 DEX 协议，每种都有不同的账户结构和流动性模型。
        </p>

        {/* Raydium AMM */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#3b82f6]">Raydium AMM (V4)</h2>
          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <h3 className="text-lg font-medium mb-3">账户结构</h3>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`// Raydium AMM 使用恒定乘积模型，类似 Uniswap V2

interface RaydiumAmmPool {
  ammId: PublicKey           // 池地址
  ammAuthority: PublicKey    // PDA 权限
  poolCoinTokenAccount: PublicKey   // Token A vault
  poolPcTokenAccount: PublicKey     // Token B vault
  coinReserve: bigint
  pcReserve: bigint
}

// 解析流程：
const poolData = await connection.getAccountInfo(ammId)
const pool = RaydiumAmmLayout.decode(poolData.data)
const coinBalance = await connection.getTokenAccountBalance(
  pool.poolCoinTokenAccount
)`}
            </pre>
          </div>
        </section>

        {/* Raydium CLMM */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#8b5cf6]">Raydium CLMM (集中流动性)</h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">与 V3 相似：</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Tick 系统</li>
                <li>• 集中流动性范围</li>
                <li>• sqrtPrice 表示</li>
              </ul>
            </div>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
              <p className="text-sm text-gray-400 mb-2">不同点：</p>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• 账户模型 vs 存储槽</li>
                <li>• Tick 存储在独立账户</li>
                <li>• 使用 Anchor 框架</li>
              </ul>
            </div>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`interface RaydiumClmmPool {
  poolState: PublicKey
  tickArrays: PublicKey[]   // 每个包含 60 个 Tick
  sqrtPriceX64: bigint
  tickCurrent: number
  liquidity: bigint
}

// 解析流程：
const poolState = await program.account.poolState.fetch(poolAddress)
const tickArrayPDAs = getTickArrayPDAs(poolAddress, tickCurrent, range)
const tickArrays = await connection.getMultipleAccountsInfo(tickArrayPDAs)`}
            </pre>
          </div>
        </section>

        {/* Meteora DLMM */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#f59e0b]">Meteora DLMM (动态流动性)</h2>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">Bin 系统</h3>
            <p className="text-gray-300 mb-4">
              Meteora 使用 <span className="text-[#f59e0b] font-semibold">Bin</span> 系统，类似于离散的价格桶：
            </p>
            <ul className="text-sm text-gray-400 space-y-1 mb-4">
              <li>• 每个 Bin 代表一个精确的价格点</li>
              <li>• 流动性只在 Bin 内有效</li>
              <li>• 支持更精细的价格控制</li>
            </ul>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`import { DLMM } from '@meteora-ag/dlmm'

async function getMeteoraBinsData(poolAddress: string, priceUsd: number) {
  const dlmmPool = await DLMM.create(connection, new PublicKey(poolAddress))

  // 1. 获取代币精度 - 必须从链上读取
  const tokenXMint = dlmmPool.lbPair?.tokenXMint
  const [tokenXMintInfo, tokenYMintInfo] = await Promise.all([
    connection.getParsedAccountInfo(tokenXMint),
    connection.getParsedAccountInfo(tokenYMint),
  ])

  // 2. 获取 Bin 数据（500 个范围）
  const binsResult = await dlmmPool.getBinsAroundActiveBin(500, 500)

  // 3. 处理数据
  const bins = binsResult.bins.map(bin => ({
    binId: bin.binId,
    price: parseFloat(bin.pricePerToken),
    liquidityUSD: xAmount * priceUsd + yAmount
  }))
}`}
            </pre>
          </div>
        </section>

        {/* Orca */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#06b6d4]">Orca Whirlpool</h2>
          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <p className="text-gray-400 mb-4">
              Orca Whirlpool 是 Solana 上最受欢迎的集中流动性协议，结构类似 Uniswap V3。
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`interface WhirlpoolData {
  tickSpacing: number
  feeRate: number
  liquidity: bigint
  sqrtPrice: bigint
  tickCurrentIndex: number
  tokenMintA: PublicKey
  tokenVaultA: PublicKey
  tokenMintB: PublicKey
  tokenVaultB: PublicKey
}

// 解析类似 Raydium CLMM，使用 TickArray 账户`}
            </pre>
          </div>
        </section>

        {/* PumpSwap */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#ec4899]">PumpSwap (Bonding Curve)</h2>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">Bonding Curve 模型</h3>
            <p className="text-gray-300 mb-4">
              PumpSwap 使用 <span className="text-[#ec4899] font-semibold">Bonding Curve</span>，价格随购买量增加：
            </p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-center text-lg mb-4">
              Price = f(Supply) = a × Supply<sup>n</sup>
            </div>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`interface PumpSwapPool {
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean  // 完成后迁移到 Raydium AMM
}

function calculatePrice(pool: PumpSwapPool) {
  const virtualProduct = pool.virtualTokenReserves * pool.virtualSolReserves
  const newTokenReserves = pool.virtualTokenReserves - 1n
  const newSolReserves = virtualProduct / newTokenReserves
  return newSolReserves - pool.virtualSolReserves
}`}
            </pre>
          </div>
        </section>

        {/* DEX 类型检测 */}
        <section>
          <h2 className="text-2xl font-bold mb-6">自动 DEX 类型检测</h2>
          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`function detectSolanaDexType(dexId?: string): SolanaDexType {
  if (!dexId) return 'unknown'
  const dexLower = dexId.toLowerCase()

  if (dexLower.includes('pump')) return 'pumpswap'
  if (dexLower.includes('raydium')) {
    return dexLower.includes('clmm') ? 'raydium-clmm' : 'raydium-amm'
  }
  if (dexLower.includes('orca')) return 'orca'
  if (dexLower.includes('meteora')) return 'meteora'

  return 'unknown'
}`}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
