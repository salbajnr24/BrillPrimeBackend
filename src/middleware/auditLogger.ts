import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { auditLogs } from '../schema';

interface AuditLogData {
  userId?: number;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

export class AuditLogger {
  static async log(data: AuditLogData): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        success: data.success,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: data.timestamp
      });
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }

  static async logAuth(req: Request, action: string, success: boolean, error?: string): Promise<void> {
    await this.log({
      userId: req.session?.userId,
      action,
      resource: 'AUTH',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      timestamp: new Date(),
      success,
      errorMessage: error,
      metadata: {
        email: req.body.email,
        role: req.body.role || req.session?.userRole
      }
    });
  }

  static async logTransaction(
    req: Request, 
    action: string, 
    transactionId: string,
    oldData?: any, 
    newData?: any,
    success: boolean = true,
    error?: string
  ): Promise<void> {
    await this.log({
      userId: req.session?.userId,
      action,
      resource: 'TRANSACTION',
      resourceId: transactionId,
      oldValues: oldData,
      newValues: newData,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      timestamp: new Date(),
      success,
      errorMessage: error
    });
  }
}

export const auditMiddleware = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    let responseData: any;

    res.send = function(data: any) {
      responseData = data;
      return originalSend.call(this, data);
    };

    const originalBody = { ...req.body };

    res.on('finish', async () => {
      try {
        const success = res.statusCode < 400;
        let errorMessage;
        let newValues = req.body;

        if (!success && responseData) {
          try {
            const parsed = JSON.parse(responseData);
            errorMessage = parsed.message || parsed.error;
          } catch (e) {
            errorMessage = 'Unknown error';
          }
        }

        await AuditLogger.log({
          userId: req.session?.userId,
          action,
          resource,
          resourceId: req.params.id || req.params.userId || req.params.orderId,
          oldValues: originalBody,
          newValues: success ? newValues : undefined,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          sessionId: req.sessionID,
          timestamp: new Date(),
          success,
          errorMessage,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode
          }
        });
      } catch (error) {
        console.error('Audit middleware error:', error);
      }
    });

    next();
  };
};

export const authAudit = auditMiddleware('AUTH', 'AUTHENTICATION');
export const transactionAudit = auditMiddleware('TRANSACTION', 'PAYMENT');
export const userAudit = auditMiddleware('USER_MANAGEMENT', 'USER');
export const orderAudit = auditMiddleware('ORDER', 'ORDER');