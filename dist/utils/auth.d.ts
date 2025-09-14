import { RequestHandler } from 'express';
export interface JWTPayload {
    userId: number;
    email: string;
    role: 'CONSUMER' | 'MERCHANT' | 'DRIVER' | 'VENDOR' | 'ADMIN';
}
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hashedPassword: string) => Promise<boolean>;
export declare const generateToken: (payload: JWTPayload) => string;
export declare const verifyToken: (token: string) => JWTPayload;
export declare const generateOTP: () => string;
export declare const authenticateToken: RequestHandler;
export declare const authorizeRoles: (...roles: string[]) => RequestHandler;
