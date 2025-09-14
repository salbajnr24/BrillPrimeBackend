"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = exports.RedisCache = exports.InMemoryCache = void 0;
class InMemoryCache {
    constructor() {
        this.cache = new Map();
    }
    async get(key) {
        const item = this.cache.get(key);
        if (!item)
            return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }
    async set(key, value, ttl) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { value, expiry });
        return true;
    }
    async del(key) {
        return this.cache.delete(key);
    }
    async reset() {
        this.cache.clear();
    }
    async update(key, value) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        this.cache.set(key, { value, expiry: item.expiry });
        return true;
    }
}
exports.InMemoryCache = InMemoryCache;
// For Redis implementation, you would need to install redis package
// and implement similar to the NestJS version
class RedisCache {
    constructor() {
        // Implementation would require redis package
        // For now, fallback to in-memory cache
        this.fallback = new InMemoryCache();
    }
    async get(key) {
        // TODO: Implement Redis connection
        return this.fallback.get(key);
    }
    async set(key, value, ttl) {
        // TODO: Implement Redis connection
        return this.fallback.set(key, value, ttl);
    }
    async del(key) {
        // TODO: Implement Redis connection
        return this.fallback.del(key);
    }
    async reset() {
        // TODO: Implement Redis connection
        return this.fallback.reset();
    }
    async update(key, value) {
        // TODO: Implement Redis connection
        return this.fallback.update(key, value);
    }
}
exports.RedisCache = RedisCache;
// Cache manager factory
class CacheManager {
    static getInstance(type = 'memory') {
        if (!this.instance) {
            this.instance = type === 'redis' ? new RedisCache() : new InMemoryCache();
        }
        return this.instance;
    }
}
exports.CacheManager = CacheManager;
