import { Request, Response, NextFunction } from 'express';
interface RateLimitOptions {
    windowMs: number;
    maxRequests: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export declare class RateLimiter {
    private cache;
    private options;
    constructor(options: RateLimitOptions);
    middleware(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
    private generateKey;
}
export declare const authLimiter: RateLimiter;
export declare const apiLimiter: RateLimiter;
export declare const uploadLimiter: RateLimiter;
export {};
