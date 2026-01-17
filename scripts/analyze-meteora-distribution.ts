/**
 * Analysis: Compare our simulated liquidity distribution with real Meteora data
 *
 * Real Data from Meteora API:
 * - Reserve X (TRUMP): 17,892,385,188,709 raw = 17,892,385.19 TRUMP (9 decimals)
 * - Reserve Y (USDC): 58,024,407,614,442 raw = 58,024,407.61 USDC (6 decimals)
 * - Total Liquidity: $154,571,732.59
 * - bin_step: 50 (0.5% per bin)
 * - current_price: $5.40
 */

// Real reserve data
const realData = {
  reserveX: 17892385.19, // TRUMP tokens
  reserveY: 58024407.61, // USDC tokens
  totalLiquidityUsd: 154571732.59,
  binStep: 50, // 0.5% per bin
  currentPrice: 5.40,
};

// Calculate real liquidity distribution
// In DLMM, reserve X is mostly in bins ABOVE current price (asks)
// and reserve Y is mostly in bins BELOW current price (bids)
const realValueX = realData.reserveX * realData.currentPrice; // $96.6M in TRUMP
const realValueY = realData.reserveY; // $58M in USDC

console.log('=== REAL METEORA DATA ===');
console.log(`Total Liquidity: $${realData.totalLiquidityUsd.toLocaleString()}`);
console.log(`Reserve X (TRUMP): ${realData.reserveX.toLocaleString()} = $${realValueX.toLocaleString()}`);
console.log(`Reserve Y (USDC): ${realData.reserveY.toLocaleString()} = $${realValueY.toLocaleString()}`);
console.log(`Bid side (USDC): ${((realValueY / realData.totalLiquidityUsd) * 100).toFixed(1)}%`);
console.log(`Ask side (TRUMP): ${((realValueX / realData.totalLiquidityUsd) * 100).toFixed(1)}%`);
console.log('');

// Our current simulation (exponential decay)
function simulateExponentialDecay(
  liquidity: number,
  binStep: number,
  price: number,
  levels: number = 50
) {
  const binStepBps = binStep / 10000;
  const bids: { price: number; liquidity: number }[] = [];
  const asks: { price: number; liquidity: number }[] = [];

  const totalWeight = Array.from({ length: levels }, (_, i) => Math.exp(-i / 15))
    .reduce((a, b) => a + b, 0);

  let totalBidLiquidity = 0;
  let totalAskLiquidity = 0;

  for (let i = 1; i <= levels; i++) {
    const weight = Math.exp(-(i - 1) / 15) / totalWeight;
    const levelLiquidity = liquidity * weight;

    const askPrice = price * Math.pow(1 + binStepBps, i);
    asks.push({ price: askPrice, liquidity: levelLiquidity });
    totalAskLiquidity += levelLiquidity;

    const bidPrice = price * Math.pow(1 + binStepBps, -i);
    bids.push({ price: bidPrice, liquidity: levelLiquidity });
    totalBidLiquidity += levelLiquidity;
  }

  return { bids, asks, totalBidLiquidity, totalAskLiquidity };
}

const simulated = simulateExponentialDecay(
  realData.totalLiquidityUsd,
  realData.binStep,
  realData.currentPrice,
  50
);

console.log('=== OUR SIMULATION (Exponential Decay) ===');
console.log(`Total Bid Liquidity: $${simulated.totalBidLiquidity.toLocaleString()}`);
console.log(`Total Ask Liquidity: $${simulated.totalAskLiquidity.toLocaleString()}`);
console.log(`Bid side: ${((simulated.totalBidLiquidity / (simulated.totalBidLiquidity + simulated.totalAskLiquidity)) * 100).toFixed(1)}%`);
console.log(`Ask side: ${((simulated.totalAskLiquidity / (simulated.totalBidLiquidity + simulated.totalAskLiquidity)) * 100).toFixed(1)}%`);
console.log('');

// Show first 10 levels
console.log('=== DISTRIBUTION COMPARISON (First 10 levels) ===');
console.log('Level | Bid Price | Bid Liq | Ask Price | Ask Liq');
console.log('------|-----------|---------|-----------|--------');
for (let i = 0; i < 10; i++) {
  const bid = simulated.bids[i];
  const ask = simulated.asks[i];
  console.log(
    `  ${i + 1}   | $${bid.price.toFixed(4)} | $${(bid.liquidity / 1e6).toFixed(2)}M | $${ask.price.toFixed(4)} | $${(ask.liquidity / 1e6).toFixed(2)}M`
  );
}

console.log('');
console.log('=== PROBLEM ANALYSIS ===');
console.log('');
console.log('1. Our simulation distributes 50/50 between bids and asks');
console.log(`   Real data shows: ${((realValueY / realData.totalLiquidityUsd) * 100).toFixed(1)}% bids, ${((realValueX / realData.totalLiquidityUsd) * 100).toFixed(1)}% asks`);
console.log('');
console.log('2. We use exponential decay which concentrates near current price');
console.log('   Real DLMM distribution depends on LP positions');
console.log('');
console.log('3. DLMM bins are discrete, we use continuous approximation');
console.log('');

// Proposed improvement: Use actual reserve ratio
console.log('=== PROPOSED IMPROVEMENT ===');
console.log('');
console.log('Use reserve ratio to weight bid/ask distribution:');

function simulateWithReserveRatio(
  totalLiquidity: number,
  reserveX: number, // base token amount
  reserveY: number, // quote token amount (USDC)
  binStep: number,
  price: number,
  levels: number = 50
) {
  const binStepBps = binStep / 10000;
  const bids: { price: number; liquidity: number }[] = [];
  const asks: { price: number; liquidity: number }[] = [];

  // Calculate value in each reserve
  const valueX = reserveX * price;
  const valueY = reserveY;
  const totalValue = valueX + valueY;

  // Weight distribution based on reserves
  // More USDC = more bid liquidity, More Token = more ask liquidity
  const bidRatio = valueY / totalValue;
  const askRatio = valueX / totalValue;

  const bidLiquidity = totalLiquidity * bidRatio;
  const askLiquidity = totalLiquidity * askRatio;

  const totalWeight = Array.from({ length: levels }, (_, i) => Math.exp(-i / 15))
    .reduce((a, b) => a + b, 0);

  let totalBidLiq = 0;
  let totalAskLiq = 0;

  for (let i = 1; i <= levels; i++) {
    const weight = Math.exp(-(i - 1) / 15) / totalWeight;

    const askPrice = price * Math.pow(1 + binStepBps, i);
    const askLevelLiq = askLiquidity * weight;
    asks.push({ price: askPrice, liquidity: askLevelLiq });
    totalAskLiq += askLevelLiq;

    const bidPrice = price * Math.pow(1 + binStepBps, -i);
    const bidLevelLiq = bidLiquidity * weight;
    bids.push({ price: bidPrice, liquidity: bidLevelLiq });
    totalBidLiq += bidLevelLiq;
  }

  return { bids, asks, totalBidLiquidity: totalBidLiq, totalAskLiquidity: totalAskLiq, bidRatio, askRatio };
}

const improved = simulateWithReserveRatio(
  realData.totalLiquidityUsd,
  realData.reserveX,
  realData.reserveY,
  realData.binStep,
  realData.currentPrice,
  50
);

console.log(`Bid ratio: ${(improved.bidRatio * 100).toFixed(1)}%`);
console.log(`Ask ratio: ${(improved.askRatio * 100).toFixed(1)}%`);
console.log(`Total Bid Liquidity: $${improved.totalBidLiquidity.toLocaleString()}`);
console.log(`Total Ask Liquidity: $${improved.totalAskLiquidity.toLocaleString()}`);
console.log('');
console.log('Level | Bid Price | Bid Liq | Ask Price | Ask Liq');
console.log('------|-----------|---------|-----------|--------');
for (let i = 0; i < 10; i++) {
  const bid = improved.bids[i];
  const ask = improved.asks[i];
  console.log(
    `  ${i + 1}   | $${bid.price.toFixed(4)} | $${(bid.liquidity / 1e6).toFixed(2)}M | $${ask.price.toFixed(4)} | $${(ask.liquidity / 1e6).toFixed(2)}M`
  );
}
