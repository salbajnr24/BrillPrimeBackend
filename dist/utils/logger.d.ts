import { Request, Response } from 'express';
export declare enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug"
}
declare class Logger {
    private service;
    constructor(service?: string);
    private formatLog;
    private write;
    error(message: string, metadata?: Record<string, any>): void;
    warn(message: string, metadata?: Record<string, any>): void;
    info(message: string, metadata?: Record<string, any>): void;
    debug(message: string, metadata?: Record<string, any>): void;
    requestLogger(): (req: Request, res: Response, next: Function) => void;
}
export declare const logger: Logger;
export declare const logError: (error: Error, context?: Record<string, any>) => void;
export {};
