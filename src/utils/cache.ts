
export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: any, ttl: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
  reset(): Promise<void>;
  update(key: string, value: any): Promise<boolean>;
}

export class InMemoryCache implements ICacheService {
  private cache: Map<string, { value: any; expiry: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl: number): Promise<boolean> {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async reset(): Promise<void> {
    this.cache.clear();
  }

  async update(key: string, value: any): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    
    this.cache.set(key, { value, expiry: item.expiry });
    return true;
  }
}

// For Redis implementation, you would need to install redis package
// and implement similar to the NestJS version
export class RedisCache implements ICacheService {
  // Implementation would require redis package
  // For now, fallback to in-memory cache
  private fallback = new InMemoryCache();

  async get(key: string): Promise<string | null> {
    // TODO: Implement Redis connection
    return this.fallback.get(key);
  }

  async set(key: string, value: any, ttl: number): Promise<boolean> {
    // TODO: Implement Redis connection
    return this.fallback.set(key, value, ttl);
  }

  async del(key: string): Promise<boolean> {
    // TODO: Implement Redis connection
    return this.fallback.del(key);
  }

  async reset(): Promise<void> {
    // TODO: Implement Redis connection
    return this.fallback.reset();
  }

  async update(key: string, value: any): Promise<boolean> {
    // TODO: Implement Redis connection
    return this.fallback.update(key, value);
  }
}

// Cache manager factory
export class CacheManager {
  private static instance: ICacheService;

  static getInstance(type: 'memory' | 'redis' = 'memory'): ICacheService {
    if (!this.instance) {
      this.instance = type === 'redis' ? new RedisCache() : new InMemoryCache();
    }
    return this.instance;
  }
}
