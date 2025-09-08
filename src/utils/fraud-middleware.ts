
import { Request, Response, NextFunction } from 'express';
import { FraudDetection, ActivityData } from './fraud-detection';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    role: string;
    email: string;
  };
  session?: {
    id?: string;
  };
}

export const fraudDetectionMiddleware = (activityType: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(); // Skip fraud detection if user is not authenticated
      }

      const activityData: ActivityData = {
        userId: req.user.userId,
        activityType,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceFingerprint: req.get('X-Device-Fingerprint'), // Custom header from frontend
        sessionId: req.session?.id || req.headers['x-session-id'] as string,
        metadata: {
          endpoint: req.path,
          method: req.method,
          body: req.body,
          query: req.query,
        },
      };

      // Add location if available
      const location = req.get('X-User-Location');
      if (location) {
        try {
          activityData.location = JSON.parse(location);
        } catch (e) {
          // Ignore invalid location data
        }
      }

      const fraudCheck = await FraudDetection.checkActivity(activityData);

      if (fraudCheck.shouldBlock) {
        return res.status(403).json({
          error: 'Activity blocked due to security concerns',
          code: 'FRAUD_DETECTION_BLOCK',
          riskScore: fraudCheck.riskScore,
        });
      }

      if (fraudCheck.isRisky) {
        // Add warning headers but allow the request to continue
        res.set('X-Risk-Level', 'HIGH');
        res.set('X-Risk-Score', fraudCheck.riskScore.toString());
      }

      // Attach fraud check results to request for later use
      (req as any).fraudCheck = fraudCheck;

      next();
    } catch (error) {
      console.error('Fraud detection middleware error:', error);
      // Don't block the request if fraud detection fails
      next();
    }
  };
};

export const logPaymentMismatch = async (
  userId: number,
  expectedAmount: number,
  actualAmount: number,
  paymentMethod: string,
  transactionRef?: string
) => {
  await FraudDetection.checkPaymentMismatch(
    userId,
    expectedAmount,
    actualAmount,
    paymentMethod,
    { transactionRef }
  );
};
