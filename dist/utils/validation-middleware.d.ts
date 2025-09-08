import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
export interface ValidationSchemas {
    body?: ZodSchema<any>;
    query?: ZodSchema<any>;
    params?: ZodSchema<any>;
}
export declare const validateRequest: (schemas: ValidationSchemas) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const commonSchemas: {
    id: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    pagination: z.ZodObject<{
        page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
    }, {
        limit?: string | undefined;
        page?: string | undefined;
    }>;
    search: z.ZodObject<{
        q: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        minPrice: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
        maxPrice: z.ZodEffects<z.ZodOptional<z.ZodString>, number | undefined, string | undefined>;
    }, "strip", z.ZodTypeAny, {
        category?: string | undefined;
        q?: string | undefined;
        minPrice?: number | undefined;
        maxPrice?: number | undefined;
    }, {
        category?: string | undefined;
        q?: string | undefined;
        minPrice?: string | undefined;
        maxPrice?: string | undefined;
    }>;
};
