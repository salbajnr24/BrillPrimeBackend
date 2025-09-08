"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonSchemas = exports.validateRequest = void 0;
const zod_1 = require("zod");
const validateRequest = (schemas) => {
    return (req, res, next) => {
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
        }
        catch (error) {
            console.error('Validation middleware error:', error);
            res.status(500).json({ error: 'Internal server error during validation' });
        }
    };
};
exports.validateRequest = validateRequest;
// Common validation schemas
exports.commonSchemas = {
    id: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid ID format'),
    }),
    pagination: zod_1.z.object({
        page: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 1),
        limit: zod_1.z.string().optional().transform(val => val ? parseInt(val) : 20),
    }),
    search: zod_1.z.object({
        q: zod_1.z.string().optional(),
        category: zod_1.z.string().optional(),
        minPrice: zod_1.z.string().optional().transform(val => val ? parseFloat(val) : undefined),
        maxPrice: zod_1.z.string().optional().transform(val => val ? parseFloat(val) : undefined),
    }),
};
//# sourceMappingURL=validation-middleware.js.map