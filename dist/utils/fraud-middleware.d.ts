import { RequestHandler } from 'express';
export declare const fraudDetectionMiddleware: (activityType: string) => RequestHandler;
export declare const logPaymentMismatch: (userId: number, expectedAmount: number, actualAmount: number, paymentMethod: string, transactionRef?: string) => Promise<void>;
