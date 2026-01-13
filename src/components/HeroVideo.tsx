'use client';

import { useEffect, useRef, useState } from 'react';

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Order {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  x: number;
  progress: number;
}

interface Trade {
  x: number;
  y: number;
  side: 'buy' | 'sell';
  size: number;
  alpha: number;
  vy: number;
}

export default function HeroVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Chart dimensions
    const chartLeft = 60;
    const chartRight = width - 200;
    const chartTop = 60;
    const chartBottom = height - 60;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;

    // Order book dimensions
    const obLeft = chartRight + 20;
    const obWidth = width - obLeft - 20;

    // Generate initial candles
    let basePrice = 0.00000138;
    const candles: Candle[] = [];
    for (let i = 0; i < 40; i++) {
      const change = (Math.random() - 0.48) * 0.000000015;
      const open = basePrice;
      const close = basePrice + change;
      const high = Math.max(open, close) + Math.random() * 0.000000005;
      const low = Math.min(open, close) - Math.random() * 0.000000005;
      candles.push({
        open,
        high,
        low,
        close,
        volume: Math.random() * 100 + 20,
      });
      basePrice = close;
    }

    // Order flow
    const orders: Order[] = [];
    const trades: Trade[] = [];

    // Order book levels
    let bids = [
      { price: basePrice * 0.995, size: 80 },
      { price: basePrice * 0.990, size: 60 },
      { price: basePrice * 0.985, size: 45 },
      { price: basePrice * 0.980, size: 90 },
      { price: basePrice * 0.975, size: 35 },
    ];
    let asks = [
      { price: basePrice * 1.005, size: 70 },
      { price: basePrice * 1.010, size: 55 },
      { price: basePrice * 1.015, size: 85 },
      { price: basePrice * 1.020, size: 40 },
      { price: basePrice * 1.025, size: 65 },
    ];

    let frame = 0;
    let currentPrice = basePrice;
    let priceFlash = 0;
    let lastPriceDirection: 'up' | 'down' = 'up';

    const animate = () => {
      if (!isPlaying) return;

      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, width, height);

      frame++;

      // Update price periodically
      if (frame % 60 === 0) {
        const change = (Math.random() - 0.48) * 0.000000008;
        const newPrice = currentPrice + change;
        lastPriceDirection = newPrice > currentPrice ? 'up' : 'down';
        currentPrice = newPrice;
        priceFlash = 1;

        // Add new candle periodically
        if (frame % 180 === 0) {
          const open = candles[candles.length - 1].close;
          const close = currentPrice;
          candles.push({
            open,
            high: Math.max(open, close) + Math.random() * 0.000000003,
            low: Math.min(open, close) - Math.random() * 0.000000003,
            close,
            volume: Math.random() * 100 + 20,
          });
          if (candles.length > 40) candles.shift();
        }

        // Update order book
        bids = bids.map(b => ({
          ...b,
          size: Math.max(20, Math.min(100, b.size + (Math.random() - 0.5) * 20)),
        }));
        asks = asks.map(a => ({
          ...a,
          size: Math.max(20, Math.min(100, a.size + (Math.random() - 0.5) * 20)),
        }));
      }

      priceFlash *= 0.95;

      // Add random orders flowing in
      if (Math.random() > 0.92) {
        const side = Math.random() > 0.5 ? 'buy' : 'sell';
        orders.push({
          price: currentPrice * (1 + (Math.random() - 0.5) * 0.02),
          size: Math.random() * 30 + 10,
          side,
          x: side === 'buy' ? -20 : width + 20,
          progress: 0,
        });
      }

      // Calculate price range for chart
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      candles.forEach(c => {
        minPrice = Math.min(minPrice, c.low);
        maxPrice = Math.max(maxPrice, c.high);
      });
      const priceRange = maxPrice - minPrice;
      const pricePadding = priceRange * 0.1;
      minPrice -= pricePadding;
      maxPrice += pricePadding;

      const priceToY = (price: number) => {
        return chartTop + (1 - (price - minPrice) / (maxPrice - minPrice)) * chartHeight;
      };

      // Draw grid
      ctx.strokeStyle = '#1a2332';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const y = chartTop + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();

        // Price labels
        const price = maxPrice - ((maxPrice - minPrice) / 5) * i;
        ctx.fillStyle = '#6e7681';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('$' + price.toFixed(10), chartLeft - 5, y + 3);
      }

      // Draw candles
      const candleWidth = chartWidth / candles.length;
      candles.forEach((candle, i) => {
        const x = chartLeft + i * candleWidth + candleWidth / 2;
        const isGreen = candle.close >= candle.open;

        // Wick
        ctx.strokeStyle = isGreen ? '#3fb950' : '#f85149';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, priceToY(candle.high));
        ctx.lineTo(x, priceToY(candle.low));
        ctx.stroke();

        // Body
        const bodyTop = priceToY(Math.max(candle.open, candle.close));
        const bodyBottom = priceToY(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);

        ctx.fillStyle = isGreen ? '#3fb950' : '#f85149';
        ctx.fillRect(x - candleWidth * 0.35, bodyTop, candleWidth * 0.7, bodyHeight);

        // Volume bars at bottom
        const volHeight = (candle.volume / 150) * 40;
        ctx.fillStyle = isGreen ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)';
        ctx.fillRect(x - candleWidth * 0.35, chartBottom - volHeight, candleWidth * 0.7, volHeight);
      });

      // Draw current price line
      const currentY = priceToY(currentPrice);
      ctx.strokeStyle = lastPriceDirection === 'up' ? '#3fb950' : '#f85149';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartLeft, currentY);
      ctx.lineTo(chartRight, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current price label
      const priceColor = lastPriceDirection === 'up' ? '#3fb950' : '#f85149';
      ctx.fillStyle = priceColor;
      ctx.fillRect(chartRight - 90, currentY - 10, 90, 20);
      ctx.fillStyle = '#0d1117';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$' + currentPrice.toFixed(10), chartRight - 45, currentY + 4);

      // Draw order book
      ctx.fillStyle = '#161b22';
      ctx.fillRect(obLeft, chartTop, obWidth, chartHeight);
      ctx.strokeStyle = '#30363d';
      ctx.lineWidth = 1;
      ctx.strokeRect(obLeft, chartTop, obWidth, chartHeight);

      // Order book header
      ctx.fillStyle = '#8b949e';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ORDER BOOK', obLeft + obWidth / 2, chartTop - 10);

      // Draw asks (top half)
      const levelHeight = chartHeight / 12;
      asks.forEach((ask, i) => {
        const y = chartTop + 20 + i * levelHeight;
        const barWidth = (ask.size / 100) * (obWidth - 20);

        // Background bar
        ctx.fillStyle = 'rgba(248, 81, 73, 0.2)';
        ctx.fillRect(obLeft + obWidth - 10 - barWidth, y, barWidth, levelHeight - 4);

        // Price
        ctx.fillStyle = '#f85149';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('$' + ask.price.toFixed(10), obLeft + 5, y + levelHeight / 2 + 3);

        // Size
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8b949e';
        ctx.fillText(ask.size.toFixed(0), obLeft + obWidth - 15, y + levelHeight / 2 + 3);
      });

      // Spread indicator
      const spreadY = chartTop + chartHeight / 2;
      ctx.fillStyle = '#21262d';
      ctx.fillRect(obLeft, spreadY - 15, obWidth, 30);
      ctx.fillStyle = '#3fb950';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$' + currentPrice.toFixed(10), obLeft + obWidth / 2, spreadY + 5);

      // Draw bids (bottom half)
      bids.forEach((bid, i) => {
        const y = spreadY + 20 + i * levelHeight;
        const barWidth = (bid.size / 100) * (obWidth - 20);

        // Background bar
        ctx.fillStyle = 'rgba(63, 185, 80, 0.2)';
        ctx.fillRect(obLeft + 10, y, barWidth, levelHeight - 4);

        // Price
        ctx.fillStyle = '#3fb950';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('$' + bid.price.toFixed(10), obLeft + 5, y + levelHeight / 2 + 3);

        // Size
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8b949e';
        ctx.fillText(bid.size.toFixed(0), obLeft + obWidth - 15, y + levelHeight / 2 + 3);
      });

      // Update and draw flowing orders
      for (let i = orders.length - 1; i >= 0; i--) {
        const order = orders[i];
        order.progress += 0.015;

        if (order.progress >= 1) {
          // Order hit the book - create trade effect
          const tradeY = priceToY(order.price);
          for (let j = 0; j < 5; j++) {
            trades.push({
              x: order.side === 'buy' ? chartRight : chartLeft,
              y: tradeY + (Math.random() - 0.5) * 20,
              side: order.side,
              size: order.size / 5,
              alpha: 1,
              vy: (Math.random() - 0.5) * 2,
            });
          }
          orders.splice(i, 1);
          continue;
        }

        // Draw order
        const targetX = order.side === 'buy' ? chartRight : chartLeft;
        const startX = order.side === 'buy' ? -20 : width + 20;
        const x = startX + (targetX - startX) * order.progress;
        const y = priceToY(order.price);

        // Glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, order.size);
        const color = order.side === 'buy' ? '63, 185, 80' : '248, 81, 73';
        gradient.addColorStop(0, `rgba(${color}, 0.8)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, order.size, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = order.side === 'buy' ? '#3fb950' : '#f85149';
        ctx.beginPath();
        ctx.arc(x, y, order.size / 3, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = order.side === 'buy' ? 'rgba(63, 185, 80, 0.3)' : 'rgba(248, 81, 73, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }

      // Update and draw trade particles
      for (let i = trades.length - 1; i >= 0; i--) {
        const trade = trades[i];
        trade.alpha -= 0.02;
        trade.y += trade.vy;

        if (trade.alpha <= 0) {
          trades.splice(i, 1);
          continue;
        }

        const color = trade.side === 'buy' ? '63, 185, 80' : '248, 81, 73';
        ctx.fillStyle = `rgba(${color}, ${trade.alpha})`;
        ctx.beginPath();
        ctx.arc(trade.x, trade.y, trade.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw title overlay
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, width, 50);

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#3fb950';
      ctx.textAlign = 'left';
      ctx.fillText('PEPE/WETH', 20, 32);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#8b949e';
      ctx.fillText('Uniswap V3 · Ethereum', 130, 32);

      // Live indicator
      ctx.fillStyle = '#3fb950';
      ctx.beginPath();
      ctx.arc(width - 60, 28, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3fb950';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LIVE', width - 50, 32);

      // Stats bar at bottom
      ctx.fillStyle = 'rgba(13, 17, 23, 0.8)';
      ctx.fillRect(0, height - 40, width, 40);

      const stats = [
        { label: '24h Vol', value: '$2.4M', color: '#fff' },
        { label: 'Liquidity', value: '$8.2M', color: '#fff' },
        { label: '24h Change', value: '+12.4%', color: '#3fb950' },
        { label: 'Trades', value: '1,247', color: '#fff' },
      ];

      stats.forEach((stat, i) => {
        const x = 20 + i * 150;
        ctx.font = '10px monospace';
        ctx.fillStyle = '#6e7681';
        ctx.textAlign = 'left';
        ctx.fillText(stat.label, x, height - 22);
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = stat.color;
        ctx.fillText(stat.value, x, height - 8);
      });

      requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPlaying]);

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden border border-[#30363d] glow-green-box">
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
        <div className="scan-line" />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: '#0d1117' }}
      />

      {/* Play/Pause overlay */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="absolute bottom-14 right-4 p-2 bg-[#21262d]/80 hover:bg-[#30363d] rounded-lg transition-colors group"
      >
        {isPlaying ? (
          <svg className="w-5 h-5 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-gray-400 group-hover:text-[#3fb950]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Corner decorations */}
      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-[#3fb950]/50" />
      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-[#3fb950]/50" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-[#3fb950]/50" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-[#3fb950]/50" />
    </div>
  );
}
