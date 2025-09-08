export interface ICacheService {
    get(key: string): Promise<string | null>;
    set(key: string, value: any, ttl: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    reset(): Promise<void>;
    update(key: string, value: any): Promise<boolean>;
}
export declare class InMemoryCache implements ICacheService {
    private cache;
    get(key: string): Promise<string | null>;
    set(key: string, value: any, ttl: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    reset(): Promise<void>;
    update(key: string, value: any): Promise<boolean>;
}
export declare class RedisCache implements ICacheService {
    private fallback;
    get(key: string): Promise<string | null>;
    set(key: string, value: any, ttl: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    reset(): Promise<void>;
    update(key: string, value: any): Promise<boolean>;
}
export declare class CacheManager {
    private static instance;
    static getInstance(type?: 'memory' | 'redis'): ICacheService;
}
