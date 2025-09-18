
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

interface SecurityOptions {
  enableCSRF?: boolean;
  enableHelmet?: boolean;
  enableRateLimit?: boolean;
  customHeaders?: Record<string, string>;
}

class SecurityMiddleware {
  static create(options: SecurityOptions = {}) {
    const middlewares: any[] = [];

    // Helmet for security headers
    if (options.enableHelmet !== false) {
      middlewares.push(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }));
    }

    // Custom security headers
    middlewares.push((req: Request, res: Response, next: NextFunction) => {
      // Remove sensitive headers
      res.removeHeader('X-Powered-By');
      
      // Add custom security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        ...options.customHeaders
      });

      next();
    });

    // Input validation
    middlewares.push((req: Request, res: Response, next: NextFunction) => {
      // Sanitize input
      if (req.body) {
        req.body = SecurityMiddleware.sanitizeObject(req.body);
      }
      if (req.query) {
        req.query = SecurityMiddleware.sanitizeObject(req.query);
      }
      if (req.params) {
        req.params = SecurityMiddleware.sanitizeObject(req.params);
      }

      next();
    });

    return middlewares;
  }

  private static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip potentially dangerous keys
      if (key.startsWith('__') || key.includes('prototype')) {
        continue;
      }

      if (typeof value === 'string') {
        // Basic XSS prevention
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>?/gm, '')
          .trim();
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' ? SecurityMiddleware.sanitizeObject(item) : item
        );
      } else if (typeof value === 'object') {
        sanitized[key] = SecurityMiddleware.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static validateInput(req: Request, res: Response, next: NextFunction) {
    // Check for SQL injection patterns
    const sqlInjectionPattern = /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|SELECT|UPDATE|UNION( +ALL){0,1})\b)/i;
    
    const checkForSQLInjection = (value: string): boolean => {
      return sqlInjectionPattern.test(value);
    };

    const validateObject = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return checkForSQLInjection(obj);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const value of Object.values(obj)) {
          if (validateObject(value)) {
            return true;
          }
        }
      }
      
      return false;
    };

    if (req.body && validateObject(req.body)) {
      return res.status(400).json({ error: 'Invalid input detected' });
    }

    if (req.query && validateObject(req.query)) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }

    next();
  }
}

export { SecurityMiddleware };
