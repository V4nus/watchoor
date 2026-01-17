/**
 * API Input Validation and Rate Limiting Utilities
 */

import { NextResponse } from 'next/server';

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting configuration
 */
export const RATE_LIMITS = {
  default: { maxRequests: 100, windowMs: 60000 }, // 100 req/min
  liquidity: { maxRequests: 60, windowMs: 60000 }, // 60 req/min for expensive queries
  search: { maxRequests: 30, windowMs: 60000 }, // 30 req/min for search
} as const;

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(
  identifier: string,
  config: { maxRequests: number; windowMs: number } = RATE_LIMITS.default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = rateLimitStore.get(identifier);

  if (!limit || now > limit.resetAt) {
    const newLimit = { count: 1, resetAt: now + config.windowMs };
    rateLimitStore.set(identifier, newLimit);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: newLimit.resetAt };
  }

  if (limit.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: limit.resetAt };
  }

  limit.count++;
  return { allowed: true, remaining: config.maxRequests - limit.count, resetAt: limit.resetAt };
}

/**
 * Rate limit error response
 */
export function rateLimitResponse(resetAt: number) {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Reset': new Date(resetAt).toISOString(),
      },
    }
  );
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate pool ID format
 * - EVM V3: 0x + 40 hex chars
 * - EVM V4: 0x + 64 hex chars
 * - Solana: 32-44 base58 chars
 */
export function isValidPoolId(poolId: string): boolean {
  // EVM format (0x prefix)
  if (/^0x[a-fA-F0-9]{40}$/.test(poolId) || /^0x[a-fA-F0-9]{64}$/.test(poolId)) {
    return true;
  }
  // Solana base58 format (32-44 alphanumeric chars, no 0/O/I/l)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(poolId)) {
    return true;
  }
  return false;
}

/**
 * Validate chain ID
 */
export function isValidChainId(chainId: string): boolean {
  const validChains = ['ethereum', 'base', 'bsc', 'solana'];
  return validChains.includes(chainId.toLowerCase());
}

/**
 * Validate and parse positive number with bounds
 */
export function validatePositiveNumber(
  value: string | null,
  options: {
    defaultValue?: number;
    min?: number;
    max?: number;
    required?: boolean;
  } = {}
): { valid: boolean; value: number; error?: string } {
  const { defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = options;

  if (value === null || value === '') {
    if (required) {
      return { valid: false, value: defaultValue, error: 'Value is required' };
    }
    return { valid: true, value: defaultValue };
  }

  const parsed = parseFloat(value);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return { valid: false, value: defaultValue, error: 'Invalid number format' };
  }

  if (parsed < min) {
    return { valid: false, value: defaultValue, error: `Value must be at least ${min}` };
  }

  if (parsed > max) {
    return { valid: false, value: defaultValue, error: `Value must be at most ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Validate and parse positive integer with bounds
 */
export function validatePositiveInteger(
  value: string | null,
  options: {
    defaultValue?: number;
    min?: number;
    max?: number;
    required?: boolean;
  } = {}
): { valid: boolean; value: number; error?: string } {
  const { defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = options;

  if (value === null || value === '') {
    if (required) {
      return { valid: false, value: defaultValue, error: 'Value is required' };
    }
    return { valid: true, value: defaultValue };
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || !isFinite(parsed)) {
    return { valid: false, value: defaultValue, error: 'Invalid integer format' };
  }

  if (parsed < min) {
    return { valid: false, value: defaultValue, error: `Value must be at least ${min}` };
  }

  if (parsed > max) {
    return { valid: false, value: defaultValue, error: `Value must be at most ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Create validation error response
 */
export function validationError(message: string, field?: string) {
  return NextResponse.json(
    {
      error: message,
      field,
    },
    { status: 400 }
  );
}

/**
 * Get client identifier for rate limiting (IP or fallback)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier
  return 'unknown';
}
