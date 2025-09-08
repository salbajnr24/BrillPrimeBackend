"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLimiter = exports.apiLimiter = exports.authLimiter = exports.RateLimiter = void 0;
const cache_1 = require("./cache");
class RateLimiter {
    constructor(options) {
        this.cache = cache_1.CacheManager.getInstance();
        this.options = {
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            message: 'Too many requests, please try again later.',
            ...options,
        };
    }
    middleware() {
        return async (req, res, next) => {
            try {
                const key = this.generateKey(req);
                const current = await this.cache.get(key);
                const count = current ? parseInt(current) : 0;
                if (count >= this.options.maxRequests) {
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: this.options.message,
                        retryAfter: Math.ceil(this.options.windowMs / 1000),
                    });
                }
                // Track the request
                await this.cache.set(key, (count + 1).toString(), this.options.windowMs / 1000);
                // Add rate limit headers
                res.set({
                    'X-RateLimit-Limit': this.options.maxRequests.toString(),
                    'X-RateLimit-Remaining': Math.max(0, this.options.maxRequests - count - 1).toString(),
                    'X-RateLimit-Reset': new Date(Date.now() + this.options.windowMs).toISOString(),
                });
                next();
            }
            catch (error) {
                console.error('Rate limiter error:', error);
                next(); // Allow request to proceed on error
            }
        };
    }
    generateKey(req) {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const route = req.route?.path || req.path;
        return `rate_limit:${ip}:${route}`;
    }
}
exports.RateLimiter = RateLimiter;
// Predefined rate limiters
exports.authLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
});
exports.apiLimiter = new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
});
exports.uploadLimiter = new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 uploads per hour
    message: 'Upload limit exceeded, please try again later.',
});
//# sourceMappingURL=rate-limit.js.map