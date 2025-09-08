import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        userId: number;
        role: string;
        email: string;
    };
}
export declare const fraudDetectionMiddleware: (activityType: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const logPaymentMismatch: (userId: number, expectedAmount: number, actualAmount: number, paymentMethod: string, transactionRef?: string) => Promise<void>;
