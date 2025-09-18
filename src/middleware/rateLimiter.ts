
import { Request, Response, NextFunction } from 'express';
import { ICacheService, InMemoryCache } from '../utils/cache';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitInfo {
  totalHits: number;
  resetTime: number;
}

class RateLimiter {
  private cache: ICacheService;

  constructor(cache?: ICacheService) {
    this.cache = cache || new InMemoryCache();
  }

  middleware(options: RateLimitOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = options.keyGenerator 
          ? options.keyGenerator(req)
          : `ratelimit:${req.ip}:${req.originalUrl || req.url}`;

        const now = Date.now();
        const windowStart = now - options.windowMs;

        // Get current rate limit info
        const cachedInfo = await this.cache.get(key);
        let rateLimitInfo: RateLimitInfo = cachedInfo 
          ? JSON.parse(cachedInfo)
          : { totalHits: 0, resetTime: now + options.windowMs };

        // Reset if window has expired
        if (now > rateLimitInfo.resetTime) {
          rateLimitInfo = {
            totalHits: 0,
            resetTime: now + options.windowMs
          };
        }

        // Increment hit count
        rateLimitInfo.totalHits++;

        // Update cache
        await this.cache.set(key, JSON.stringify(rateLimitInfo), options.windowMs);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, options.maxRequests - rateLimitInfo.totalHits).toString(),
          'X-RateLimit-Reset': new Date(rateLimitInfo.resetTime).toISOString()
        });

        // Check if limit exceeded
        if (rateLimitInfo.totalHits > options.maxRequests) {
          if (options.onLimitReached) {
            options.onLimitReached(req, res);
          }

          return res.status(429).json({
            error: options.message || 'Too many requests',
            retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        next();
      }
    };
  }
}

export const rateLimiter = new RateLimiter();
export { RateLimiter, RateLimitOptions };
