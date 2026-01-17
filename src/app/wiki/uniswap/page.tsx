'use client';

import Link from 'next/link';
import { ArrowLeft, GitBranch } from 'lucide-react';

export default function UniswapWikiPage() {
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
            <GitBranch className="text-[#22c55e]" size={20} />
            Uniswap 解析原理
          </h1>
        </div>
      </header>

      <main className="pt-20 pb-16 px-6 max-w-4xl mx-auto">
        {/* V2 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#f97316]">Uniswap V2 - 恒定乘积做市商</h2>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">核心公式</h3>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-center text-xl mb-4">
              <span className="text-[#22c55e]">x</span> × <span className="text-[#f97316]">y</span> = <span className="text-[#58a6ff]">k</span> (常数)
            </div>
            <p className="text-gray-400 text-sm">
              其中 x 和 y 是两种代币的储备量，k 是常数。任何交易都必须保持 k 不变。
            </p>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">流动性深度计算</h3>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`// 1. 从合约读取储备量
const [reserve0, reserve1] = await pool.getReserves()

// 2. 计算当前价格
const price = reserve1 / reserve0  // token1 per token0

// 3. 计算在各价格点的可用流动性
// V2 的流动性沿着 xy=k 曲线均匀分布
// 在价格 P 处，可交换的代币量：
// Δx = x - k/P  (卖出 token0)
// Δy = y - k×P  (买入 token0)

// 4. 生成订单簿深度
for (let priceLevel of priceLevels) {
  const liquidityAtPrice = calculateLiquidityAtPrice(
    reserve0, reserve1, priceLevel
  )
  // 价格 < 当前价格 → bid (买单)
  // 价格 > 当前价格 → ask (卖单)
}`}
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
              <h4 className="font-medium text-[#22c55e] mb-2">优点</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• 简单直观，易于理解</li>
                <li>• 任何价格都有流动性</li>
                <li>• Gas 成本低</li>
              </ul>
            </div>
            <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-4">
              <h4 className="font-medium text-[#f85149] mb-2">缺点</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• 资本效率低</li>
                <li>• 大额交易滑点高</li>
                <li>• LP 无法选择价格范围</li>
              </ul>
            </div>
          </div>
        </section>

        {/* V3 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#a855f7]">Uniswap V3 - 集中流动性</h2>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">核心概念：Tick 系统</h3>
            <p className="text-gray-300 mb-4">V3 将价格空间划分为离散的 <span className="text-[#a855f7] font-mono">Tick</span>，每个 Tick 代表一个价格点：</p>
            <div className="bg-black/50 p-4 rounded-lg font-mono text-center text-lg mb-4">
              price(i) = 1.0001<sup className="text-[#a855f7]">i</sup>
            </div>
            <p className="text-sm text-gray-400">
              例如：Tick 0 = 价格 1.0，Tick 100 = 价格 1.0001^100 ≈ 1.01005
            </p>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">流动性深度解析流程</h3>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`// 1. 读取当前状态
const slot0 = await pool.slot0()
const currentTick = slot0.tick
const sqrtPriceX96 = slot0.sqrtPriceX96
const currentLiquidity = await pool.liquidity()

// 2. 扫描 TickBitmap 找到所有初始化的 Tick
// TickBitmap 是 256 位的字，每个 bit 代表一个 Tick
const tickBitmap = await pool.tickBitmap(wordPosition)

// 3. 批量获取 Tick 数据
for (let tick of initializedTicks) {
  const tickData = await pool.ticks(tick)
  // tickData 包含:
  // - liquidityGross: 该 Tick 的总流动性
  // - liquidityNet: 跨越该 Tick 时流动性的净变化
}

// 4. 计算每个价格范围的流动性
let liquidity = currentLiquidity
for (let tick = currentTick; tick > minTick; tick--) {
  if (isInitialized(tick)) {
    liquidity -= tickData[tick].liquidityNet
  }
}`}
            </pre>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">Tick 位图优化</h3>
            <p className="text-gray-400 text-sm mb-3">
              直接查询所有 Tick 会消耗大量 RPC 调用。我们使用 <span className="text-[#a855f7]">TickBitmap</span> 优化：
            </p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li><span className="text-[#22c55e]">1.</span> 每个 word (256 bits) 代表 256 个连续 Tick 的初始化状态</li>
              <li><span className="text-[#22c55e]">2.</span> 只查询 bit=1 的 Tick，跳过空 Tick</li>
              <li><span className="text-[#22c55e]">3.</span> 使用 Multicall3 批量获取，减少 RPC 调用 95%</li>
            </ul>
          </div>
        </section>

        {/* V4 */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-[#22c55e]">Uniswap V4 - 单例合约架构</h2>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">架构变化</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">V3 架构：</p>
                <p className="font-mono text-sm text-gray-500">每个池 = 独立合约地址<br/>(0x...40字符)</p>
              </div>
              <div className="bg-black/50 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">V4 架构：</p>
                <p className="font-mono text-sm text-[#22c55e]">所有池 = PoolManager 内部状态<br/>(PoolId = 32字节)</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">PoolId 识别</h3>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`// V4 池由 PoolKey 唯一标识
interface PoolKey {
  currency0: address    // 代币 0 地址
  currency1: address    // 代币 1 地址
  fee: uint24          // 手续费等级
  tickSpacing: int24   // Tick 间距
  hooks: address       // Hook 合约地址
}

// PoolId = keccak256(abi.encode(PoolKey))
// 结果是 32 字节 (64 hex 字符)
// 例如: 0x98c8f03094a9e65ccedc14c40130e4a5...

// 识别方法：
if (poolAddress.length === 66) {  // 0x + 64 chars
  return 'v4'
} else if (poolAddress.length === 42) {  // 0x + 40 chars
  return 'v3' or 'v2'
}`}
            </pre>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-medium mb-3">状态读取方式</h3>
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`// V4 使用 StateView 合约读取 PoolManager 内部状态

// 1. 获取池状态 (slot0 等效)
const poolState = await stateView.getSlot0(poolId)
// 返回: sqrtPriceX96, tick, protocolFee, lpFee

// 2. 获取流动性
const liquidity = await stateView.getLiquidity(poolId)

// 3. 获取 Tick 数据
// 使用 StateView.getTickInfo(poolId, tick)

// 4. 后续流程与 V3 类似`}
            </pre>
          </div>

          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <h3 className="text-lg font-medium mb-3 text-[#22c55e]">V4 优势</h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• <span className="text-[#22c55e]">Flash Accounting</span> - 多跳交易只在最后结算，节省 Gas</li>
              <li>• <span className="text-[#22c55e]">Hooks</span> - 可编程的交易前/后逻辑</li>
              <li>• <span className="text-[#22c55e]">Native ETH</span> - 直接支持 ETH，无需包装</li>
              <li>• <span className="text-[#22c55e]">动态手续费</span> - 可根据市场条件调整</li>
            </ul>
          </div>
        </section>

        {/* 池类型检测 */}
        <section>
          <h2 className="text-2xl font-bold mb-6">自动池类型检测</h2>
          <div className="bg-[#0d1117] border border-[#1a1a1a] rounded-xl p-6">
            <pre className="text-sm text-gray-300 overflow-x-auto bg-black/50 p-4 rounded-lg">
{`async function detectPoolType(chainId: string, poolAddress: string) {
  // 1. 根据地址长度初步判断
  if (poolAddress.length === 66) {
    return 'v4'  // 32字节 PoolId
  }

  // 2. 尝试调用 V3 特有方法
  try {
    await contract.slot0()
    await contract.tickSpacing()
    return 'v3'
  } catch {
    // 不是 V3
  }

  // 3. 尝试调用 V2 方法
  try {
    await contract.getReserves()
    return 'v2'
  } catch {
    return 'unknown'
  }
}`}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
