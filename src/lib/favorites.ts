// Favorites utility - stores user's favorite pools in localStorage

export interface FavoriteItem {
  chainId: string;
  poolAddress: string;
  symbol: string;       // e.g., "DRB"
  pair: string;         // e.g., "DRB/WETH"
  logo?: string;        // Token logo URL
  chainLogo?: string;   // Chain logo URL
  addedAt: number;      // When favorited
}

const STORAGE_KEY = '0xargus_favorites';
const MAX_FAVORITES = 20;

// Chain logos mapping
const CHAIN_LOGOS: Record<string, string> = {
  base: '/chains/base.svg',
  bsc: '/chains/bsc.svg',
  solana: '/chains/solana.png',
  ethereum: '/chains/ethereum.png',
};

/**
 * Get all favorites from localStorage
 */
export function getFavorites(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const items: FavoriteItem[] = JSON.parse(stored);
    // Sort by addedAt descending (most recent first)
    return items.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

/**
 * Check if a pool is favorited
 */
export function isFavorite(chainId: string, poolAddress: string): boolean {
  if (typeof window === 'undefined') return false;

  const favorites = getFavorites();
  return favorites.some(
    f => f.chainId === chainId && f.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );
}

/**
 * Add a pool to favorites
 */
export function addToFavorites(item: Omit<FavoriteItem, 'addedAt' | 'chainLogo'>): boolean {
  if (typeof window === 'undefined') return false;

  // Validate required fields
  if (!item.poolAddress || !item.chainId || !item.symbol || !item.pair) {
    console.warn('[Favorites] Invalid item, missing required fields:', item);
    return false;
  }

  try {
    const favorites = getFavorites();

    // Check if already favorited
    if (favorites.some(f => f.chainId === item.chainId && f.poolAddress.toLowerCase() === item.poolAddress.toLowerCase())) {
      return false; // Already favorited
    }

    // Add new entry at the beginning
    const newItem: FavoriteItem = {
      ...item,
      chainLogo: CHAIN_LOGOS[item.chainId] || CHAIN_LOGOS.ethereum,
      addedAt: Date.now(),
    };

    favorites.unshift(newItem);

    // Keep only max items
    const trimmed = favorites.slice(0, MAX_FAVORITES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[Favorites] Added:', newItem.pair);
    return true;
  } catch (e) {
    console.error('Failed to add to favorites:', e);
    return false;
  }
}

/**
 * Remove a pool from favorites
 */
export function removeFromFavorites(chainId: string, poolAddress: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const favorites = getFavorites();
    const filtered = favorites.filter(
      f => !(f.chainId === chainId && f.poolAddress.toLowerCase() === poolAddress.toLowerCase())
    );

    if (filtered.length === favorites.length) {
      return false; // Was not in favorites
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log('[Favorites] Removed pool from favorites');
    return true;
  } catch (e) {
    console.error('Failed to remove from favorites:', e);
    return false;
  }
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(item: Omit<FavoriteItem, 'addedAt' | 'chainLogo'>): boolean {
  if (isFavorite(item.chainId, item.poolAddress)) {
    removeFromFavorites(item.chainId, item.poolAddress);
    return false; // Now not favorited
  } else {
    addToFavorites(item);
    return true; // Now favorited
  }
}

/**
 * Clear all favorites
 */
export function clearFavorites(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear favorites:', e);
  }
}
