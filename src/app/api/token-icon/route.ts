import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache directory for token icons
const CACHE_DIR = path.join(process.cwd(), 'public', 'token-cache');

// Known token CoinGecko IDs mapping (symbol -> coingecko_id)
// This helps when we know the token symbol but need to query CoinGecko
const COINGECKO_IDS: Record<string, string> = {
  // Stablecoins
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'BUSD': 'binance-usd',
  'FRAX': 'frax',
  // Major tokens
  'WETH': 'weth',
  'ETH': 'ethereum',
  'WBTC': 'wrapped-bitcoin',
  'BTC': 'bitcoin',
  'BNB': 'binancecoin',
  'WBNB': 'wbnb',
  'MATIC': 'matic-network',
  'WMATIC': 'wmatic',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'SOL': 'solana',
  'AVAX': 'avalanche-2',
  // DeFi tokens
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'LINK': 'chainlink',
  'CRV': 'curve-dao-token',
  'MKR': 'maker',
  'SNX': 'havven',
  'COMP': 'compound-governance-token',
  'SUSHI': 'sushi',
  'CAKE': 'pancakeswap-token',
  'LDO': 'lido-dao',
  'ENS': 'ethereum-name-service',
  // Meme tokens
  'DOGE': 'dogecoin',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe',
  'FLOKI': 'floki',
  // Base chain popular tokens
  'EXTRA': 'extra-finance',
  'BALD': 'bald',
  'BRETT': 'brett',
  'TOSHI': 'toshi',
  'DEGEN': 'degen-base',
  // BSC popular tokens
  'ALPACA': 'alpaca-finance',
  'RACA': 'radio-caca',
  'BABY': 'babydoge',
};

// In-memory cache for CoinGecko coin data (to reduce API calls)
const coinGeckoCache: Map<string, { imageUrl: string; timestamp: number }> = new Map();
const COINGECKO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Fetch icon URL from CoinGecko by coin ID
async function getCoinGeckoImageUrl(coinId: string): Promise<string | null> {
  // Check in-memory cache first
  const cached = coinGeckoCache.get(coinId);
  if (cached && Date.now() - cached.timestamp < COINGECKO_CACHE_TTL) {
    return cached.imageUrl;
  }

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const imageUrl = data.image?.small || data.image?.thumb || null;
      if (imageUrl) {
        // Cache the result
        coinGeckoCache.set(coinId, { imageUrl, timestamp: Date.now() });
        console.log(`[Token Icon] CoinGecko found: ${coinId} -> ${imageUrl}`);
        return imageUrl;
      }
    }
  } catch (err) {
    console.warn(`[Token Icon] CoinGecko API error for ${coinId}:`, err);
  }

  return null;
}

// Search CoinGecko by symbol (slower, use as fallback)
async function searchCoinGeckoBySymbol(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const coins = data.coins || [];
      // Find exact symbol match
      const match = coins.find((c: any) => c.symbol?.toUpperCase() === symbol.toUpperCase());
      if (match?.thumb) {
        // Convert thumb to small for better quality
        const imageUrl = match.thumb.replace('/thumb/', '/small/');
        console.log(`[Token Icon] CoinGecko search found: ${symbol} -> ${imageUrl}`);
        return imageUrl;
      }
    }
  } catch (err) {
    console.warn(`[Token Icon] CoinGecko search error for ${symbol}:`, err);
  }

  return null;
}

// Get cached icon path
function getCachePath(chain: string, address: string): string {
  return path.join(CACHE_DIR, `${chain}_${address.toLowerCase()}.png`);
}

// Icon source URLs - multiple fallback sources with better coverage
function getIconUrls(chain: string, address: string): string[] {
  const lowercaseAddress = address.toLowerCase();
  const checksumAddress = address; // Keep original case for some APIs
  const urls: string[] = [];

  // DexScreener CDN variations
  urls.push(`https://dd.dexscreener.com/ds-data/tokens/${chain}/${lowercaseAddress}.png`);
  urls.push(`https://dd.dexscreener.com/ds-data/tokens/${chain}/${checksumAddress}.png`);

  // Chain-specific fallbacks
  if (chain === 'base') {
    // Basescan token icons
    urls.push(`https://basescan.org/token/images/${lowercaseAddress}_32.png`);
  }

  if (chain === 'ethereum') {
    // Etherscan token icons
    urls.push(`https://etherscan.io/token/images/${lowercaseAddress}_32.png`);
  }

  if (chain === 'bsc') {
    // BscScan token icons
    urls.push(`https://bscscan.com/token/images/${lowercaseAddress}_32.png`);
    urls.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${checksumAddress}/logo.png`);
  }

  // Trust Wallet assets (EVM chains)
  if (chain === 'base' || chain === 'ethereum' || chain === 'arbitrum' || chain === 'optimism') {
    urls.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksumAddress}/logo.png`);
  }

  return urls;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');
  const symbol = searchParams.get('symbol'); // Optional: helps with CoinGecko fallback

  if (!chain || !address) {
    return NextResponse.json(
      { error: 'Missing chain or address parameter' },
      { status: 400 }
    );
  }

  ensureCacheDir();
  const cachePath = getCachePath(chain, address);

  // Check if cached version exists and is recent (cache for 7 days)
  if (fs.existsSync(cachePath)) {
    const stats = fs.statSync(cachePath);
    const ageMs = Date.now() - stats.mtimeMs;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (ageMs < sevenDays) {
      // Serve cached file
      const imageBuffer = fs.readFileSync(cachePath);
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=604800', // 7 days browser cache
        },
      });
    }
  }

  // Fetch from source and cache
  const urls = getIconUrls(chain, address);

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/*,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://dexscreener.com/',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        // Verify it's actually an image
        if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Verify buffer is not empty and has valid image header
        if (buffer.length < 100) {
          continue;
        }

        // Save to cache
        try {
          fs.writeFileSync(cachePath, buffer);
          console.log(`[Token Icon] Cached: ${chain}/${address}`);
        } catch (writeErr) {
          console.warn('Failed to cache icon:', cachePath, writeErr);
        }

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType || 'image/png',
            'Cache-Control': 'public, max-age=604800',
          },
        });
      }
    } catch (fetchErr) {
      // Try next URL
      console.warn(`[Token Icon] Failed to fetch from ${url}:`, fetchErr);
      continue;
    }
  }

  // Try DexScreener token search API as last resort
  try {
    console.log(`[Token Icon] Trying DexScreener API for ${chain}/${address}`);
    const searchResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      const pairs = data.pairs || [];
      // Find a pair with an image URL
      for (const pair of pairs) {
        const imageUrl = pair.info?.imageUrl;
        if (imageUrl) {
          console.log(`[Token Icon] Found image URL from API: ${imageUrl}`);
          // Fetch the image from the found URL
          const imgResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            signal: AbortSignal.timeout(15000),
          });

          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer.length > 100) {
              // Save to cache
              try {
                fs.writeFileSync(cachePath, buffer);
                console.log(`[Token Icon] Cached from API: ${chain}/${address}`);
              } catch {
                // ignore
              }

              return new NextResponse(buffer, {
                headers: {
                  'Content-Type': imgResponse.headers.get('Content-Type') || 'image/png',
                  'Cache-Control': 'public, max-age=604800',
                },
              });
            }
          }
        }
      }
    }
  } catch (apiErr) {
    console.warn(`[Token Icon] DexScreener API failed:`, apiErr);
  }

  // Try CoinGecko as final fallback (if we have a symbol)
  if (symbol) {
    const upperSymbol = symbol.toUpperCase();
    let coinGeckoImageUrl: string | null = null;

    // First, check if we have a known CoinGecko ID for this symbol
    const knownCoinId = COINGECKO_IDS[upperSymbol];
    if (knownCoinId) {
      console.log(`[Token Icon] Trying CoinGecko with known ID: ${knownCoinId}`);
      coinGeckoImageUrl = await getCoinGeckoImageUrl(knownCoinId);
    }

    // If not found, try searching by symbol
    if (!coinGeckoImageUrl) {
      console.log(`[Token Icon] Searching CoinGecko by symbol: ${symbol}`);
      coinGeckoImageUrl = await searchCoinGeckoBySymbol(symbol);
    }

    if (coinGeckoImageUrl) {
      try {
        const imgResponse = await fetch(coinGeckoImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (imgResponse.ok) {
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          if (buffer.length > 100) {
            // Save to cache
            try {
              fs.writeFileSync(cachePath, buffer);
              console.log(`[Token Icon] Cached from CoinGecko: ${chain}/${address} (${symbol})`);
            } catch {
              // ignore cache write errors
            }

            return new NextResponse(buffer, {
              headers: {
                'Content-Type': imgResponse.headers.get('Content-Type') || 'image/png',
                'Cache-Control': 'public, max-age=604800',
              },
            });
          }
        }
      } catch (fetchErr) {
        console.warn(`[Token Icon] Failed to fetch CoinGecko image:`, fetchErr);
      }
    }
  }

  // All sources failed - return 404
  console.warn(`[Token Icon] No icon found for ${chain}/${address}${symbol ? ` (${symbol})` : ''}`);
  return NextResponse.json(
    { error: 'Icon not found' },
    { status: 404 }
  );
}
