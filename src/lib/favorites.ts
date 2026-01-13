// Favorites storage utility using localStorage (more reliable than cookies for this use case)

export interface FavoritePool {
  chainId: string;
  poolAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseImageUrl?: string;
  addedAt: number;
}

const FAVORITES_KEY = 'dex_favorites';
const MAX_FAVORITES = 20;

/**
 * Get all favorite pools
 */
export function getFavorites(): FavoritePool[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Check if a pool is favorited
 */
export function isFavorite(chainId: string, poolAddress: string): boolean {
  const favorites = getFavorites();
  return favorites.some(f => f.chainId === chainId && f.poolAddress.toLowerCase() === poolAddress.toLowerCase());
}

/**
 * Add a pool to favorites
 */
export function addFavorite(pool: Omit<FavoritePool, 'addedAt'>): boolean {
  if (typeof window === 'undefined') return false;

  const favorites = getFavorites();

  // Check if already exists
  if (isFavorite(pool.chainId, pool.poolAddress)) {
    return false;
  }

  // Check limit
  if (favorites.length >= MAX_FAVORITES) {
    // Remove oldest
    favorites.pop();
  }

  // Add new favorite at the beginning
  favorites.unshift({
    ...pool,
    addedAt: Date.now(),
  });

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    // Dispatch event for other components to update
    window.dispatchEvent(new CustomEvent('favorites-updated'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a pool from favorites
 */
export function removeFavorite(chainId: string, poolAddress: string): boolean {
  if (typeof window === 'undefined') return false;

  const favorites = getFavorites();
  const index = favorites.findIndex(
    f => f.chainId === chainId && f.poolAddress.toLowerCase() === poolAddress.toLowerCase()
  );

  if (index === -1) return false;

  favorites.splice(index, 1);

  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    window.dispatchEvent(new CustomEvent('favorites-updated'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle favorite status
 */
export function toggleFavorite(pool: Omit<FavoritePool, 'addedAt'>): boolean {
  if (isFavorite(pool.chainId, pool.poolAddress)) {
    removeFavorite(pool.chainId, pool.poolAddress);
    return false; // Now not favorited
  } else {
    addFavorite(pool);
    return true; // Now favorited
  }
}
