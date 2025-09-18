
import { Request, Response, NextFunction } from 'express';
import { ICacheService, InMemoryCache } from '../utils/cache';

interface CacheOptions {
  ttl: number;
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
}

class CacheMiddleware {
  private cache: ICacheService;

  constructor(cache?: ICacheService) {
    this.cache = cache || new InMemoryCache();
  }

  middleware(options: CacheOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip cache for non-GET requests or if skipCache condition is met
      if (req.method !== 'GET' || (options.skipCache && options.skipCache(req))) {
        return next();
      }

      try {
        const cacheKey = options.keyGenerator 
          ? options.keyGenerator(req)
          : `${req.originalUrl || req.url}`;

        // Try to get from cache
        const cachedData = await this.cache.get(cacheKey);
        
        if (cachedData) {
          return res.json(JSON.parse(cachedData));
        }

        // Store original json method
        const originalJson = res.json;

        // Override json method to cache the response
        res.json = function(data: any) {
          // Cache the data
          this.cache.set(cacheKey, JSON.stringify(data), options.ttl)
            .catch(error => console.error('Cache set error:', error));
          
          // Call original json method
          return originalJson.call(this, data);
        }.bind({ cache: this.cache });

        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      await this.cache.del(pattern);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

export const cacheMiddleware = new CacheMiddleware();
export { CacheMiddleware, CacheOptions };
