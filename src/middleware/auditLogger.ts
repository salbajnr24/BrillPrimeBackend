import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuditLogEntry {
  userId?: string;
  userRole?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  metadata?: any;
}

class AuditLoggerService {
  private logs: AuditLogEntry[] = [];

  async logAction(entry: AuditLogEntry): Promise<void> {
    this.logs.push(entry);

    // Log to console/file
    logger.info('Audit Log', {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      success: entry.success,
      timestamp: entry.timestamp,
      ipAddress: entry.ipAddress
    });

    // In production, you might want to store this in a database
    // await db.insert(auditLogs).values(entry);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Capture the original end function
      const originalEnd = res.end;

      res.end = function(chunk?: any, encoding?: any) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Log the request
        const auditEntry: AuditLogEntry = {
          userId: (req as any).user?.userId?.toString(),
          userRole: (req as any).user?.role,
          action: `${req.method} ${req.path}`,
          resource: req.path.split('/')[2], // Extract resource from path
          resourceId: req.params.id,
          ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          timestamp: new Date(),
          success: res.statusCode < 400,
          errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            queryParams: req.query,
            bodySize: chunk ? Buffer.byteLength(chunk) : 0
          }
        };

        // Log the audit entry
        auditLogger.logAction(auditEntry).catch(err => {
          logger.error('Failed to log audit entry', err);
        });

        // Call the original end function
        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    let filteredLogs = [...this.logs];

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action.includes(filters.action!));
      }
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
      }
      if (filters.limit) {
        filteredLogs = filteredLogs.slice(0, filters.limit);
      }
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const auditLogger = new AuditLoggerService();