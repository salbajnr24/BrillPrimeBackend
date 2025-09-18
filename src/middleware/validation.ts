
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

interface ValidationRules {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

class ValidationMiddleware {
  static validate(rules: ValidationRules) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Validate request body
        if (rules.body && req.body) {
          req.body = rules.body.parse(req.body);
        }

        // Validate query parameters
        if (rules.query && req.query) {
          req.query = rules.query.parse(req.query);
        }

        // Validate route parameters
        if (rules.params && req.params) {
          req.params = rules.params.parse(req.params);
        }

        // Validate headers
        if (rules.headers && req.headers) {
          rules.headers.parse(req.headers);
        }

        next();
      } catch (error) {
        if (error instanceof ZodError) {
          const formattedErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input
          }));

          return res.status(400).json({
            error: 'Validation failed',
            details: formattedErrors
          });
        }

        return res.status(500).json({ error: 'Internal validation error' });
      }
    };
  }

  static sanitizeHtml(req: Request, res: Response, next: NextFunction) {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        return value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>?/gm, '')
          .trim();
      }
      
      if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      }
      
      if (typeof value === 'object' && value !== null) {
        const sanitized: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitized[key] = sanitizeValue(val);
        }
        return sanitized;
      }
      
      return value;
    };

    if (req.body) {
      req.body = sanitizeValue(req.body);
    }

    if (req.query) {
      req.query = sanitizeValue(req.query);
    }

    next();
  }
}

// Common validation schemas
export const CommonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  
  pagination: z.object({
    page: z.string().transform(val => parseInt(val) || 1).pipe(z.number().min(1)),
    limit: z.string().transform(val => parseInt(val) || 10).pipe(z.number().min(1).max(100))
  }),

  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),

  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().optional()
  })
};

export { ValidationMiddleware };
