import { NextRequest, NextResponse } from 'next/server';
import { getQuoteTokenUsdPrice, getQuoteTokenUsdPrices } from '@/lib/quote-prices';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const symbols = searchParams.get('symbols'); // comma-separated list

  const cacheHeaders = { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' };

  try {
    if (symbols) {
      // Batch fetch multiple tokens
      const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);
      const prices = await getQuoteTokenUsdPrices(symbolList);
      return NextResponse.json({ success: true, prices }, { headers: cacheHeaders });
    }

    if (symbol) {
      // Single token
      const price = await getQuoteTokenUsdPrice(symbol);
      return NextResponse.json({ success: true, symbol, price }, { headers: cacheHeaders });
    }

    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  } catch (error) {
    console.error('Quote price API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
