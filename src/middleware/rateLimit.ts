/**
 * Rate Limiting Middleware
 * Token bucket algorithm for flexible rate limiting
 * Protects upload endpoints and prevents abuse
 */

import { Elysia } from "elysia";

interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Message to return when rate limit is exceeded
   */
  message?: string;
  /**
   * Skip rate limiting for certain paths (regex patterns)
   */
  skip?: RegExp[];
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limit store
 * In production, consider Redis for distributed rate limiting
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: Timer;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

const store = new RateLimitStore();

/**
 * Get client identifier from request
 * Uses IP address + User-Agent for fingerprinting
 */
function getClientId(request: Request): string {
  // Try to get real IP from headers (for proxies/load balancers)
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const ip = forwarded.split(",")[0].trim();
  const userAgent = request.headers.get("user-agent") || "unknown";

  // Create a simple hash for the client
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Check if path should skip rate limiting
 */
function shouldSkip(pathname: string, skipPatterns?: RegExp[]): boolean {
  if (!skipPatterns) return false;
  return skipPatterns.some((pattern) => pattern.test(pathname));
}

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
  return new Elysia({ name: "rate-limit" }).onBeforeHandle(
    ({ request, set }) => {
      const url = new URL(request.url);

      // Skip rate limiting for certain paths
      if (shouldSkip(url.pathname, config.skip)) {
        return;
      }

      const clientId = getClientId(request);
      const now = Date.now();
      const entry = store.get(clientId);

      if (!entry) {
        // First request from this client
        store.set(clientId, {
          count: 1,
          resetTime: now + config.windowMs,
        });
        return;
      }

      // Increment request count
      entry.count++;

      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        set.status = 429;
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

        return new Response(
          JSON.stringify({
            error: "RATE_LIMIT_EXCEEDED",
            message:
              config.message ||
              `Too many requests. Please try again in ${retryAfter} seconds.`,
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Limit": config.maxRequests.toString(),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
            },
          },
        );
      }

      // Update entry
      store.set(clientId, entry);

      // Add rate limit headers to response
      set.headers["X-RateLimit-Limit"] = config.maxRequests.toString();
      set.headers["X-RateLimit-Remaining"] = (
        config.maxRequests - entry.count
      ).toString();
      set.headers["X-RateLimit-Reset"] = new Date(
        entry.resetTime,
      ).toISOString();
    },
  );
}

/**
 * Preset: Strict rate limit for upload endpoints
 * 10 uploads per hour per client
 */
export const uploadRateLimit = rateLimit({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  message: "Upload rate limit exceeded. Maximum 10 uploads per hour.",
});

/**
 * Preset: Moderate rate limit for API endpoints
 * 100 requests per minute per client
 */
export const apiRateLimit = rateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: "API rate limit exceeded. Maximum 100 requests per minute.",
  skip: [
    /^\/models\//,
    /^\/emotes\//,
    /^\/music\//,
    /^\/dashboard/,
    /^\/swagger/,
  ],
});

/**
 * Preset: Lenient rate limit for static file serving
 * 1000 requests per minute per client
 */
export const staticFileRateLimit = rateLimit({
  maxRequests: 1000,
  windowMs: 60 * 1000, // 1 minute
  message: "Too many file requests. Please slow down.",
});

/**
 * Clean up rate limit store on shutdown
 */
export function cleanupRateLimitStore() {
  store.destroy();
}
