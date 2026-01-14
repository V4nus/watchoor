import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache directory for token icons
const CACHE_DIR = path.join(process.cwd(), 'public', 'token-cache');

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Get cached icon path
function getCachePath(chain: string, address: string): string {
  return path.join(CACHE_DIR, `${chain}_${address.toLowerCase()}.png`);
}

// Icon source URLs - DexScreener CDN is most reliable
function getIconUrls(chain: string, address: string): string[] {
  const lowercaseAddress = address.toLowerCase();
  return [
    // DexScreener CDN (most reliable)
    `https://dd.dexscreener.com/ds-data/tokens/${chain}/${lowercaseAddress}.png`,
    // Backup: raw address format
    `https://dd.dexscreener.com/ds-data/tokens/${chain}/${address}.png`,
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');

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
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save to cache
        try {
          fs.writeFileSync(cachePath, buffer);
        } catch {
          // Cache write failed, but we can still serve the image
          console.warn('Failed to cache icon:', cachePath);
        }

        return new NextResponse(buffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'image/png',
            'Cache-Control': 'public, max-age=604800',
          },
        });
      }
    } catch {
      // Try next URL
      continue;
    }
  }

  // All sources failed - return a placeholder or 404
  return NextResponse.json(
    { error: 'Icon not found' },
    { status: 404 }
  );
}
