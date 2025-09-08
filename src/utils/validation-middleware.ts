
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export interface ValidationSchemas {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export const validateRequest = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schemas.body) {
        const bodyResult = schemas.body.safeParse(req.body);
        if (!bodyResult.success) {
          return res.status(400).json({
            error: 'Invalid request body',
            details: bodyResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        req.body = bodyResult.data;
      }

      // Validate query parameters
      if (schemas.query) {
        const queryResult = schemas.query.safeParse(req.query);
        if (!queryResult.success) {
          return res.status(400).json({
            error: 'Invalid query parameters',
            details: queryResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        req.query = queryResult.data;
      }

      // Validate route parameters
      if (schemas.params) {
        const paramsResult = schemas.params.safeParse(req.params);
        if (!paramsResult.success) {
          return res.status(400).json({
            error: 'Invalid route parameters',
            details: paramsResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
            })),
          });
        }
        req.params = paramsResult.data;
      }

      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({ error: 'Internal server error during validation' });
    }
  };
};

// Common validation schemas
export const commonSchemas = {
  id: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  }),
  search: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    minPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    maxPrice: z.string().optional().transform(val => val ? parseFloat(val) : undefined),
  }),
};
