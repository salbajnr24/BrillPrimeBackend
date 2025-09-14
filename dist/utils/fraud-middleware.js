"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPaymentMismatch = exports.fraudDetectionMiddleware = void 0;
const fraud_detection_1 = require("./fraud-detection");
const fraudDetectionMiddleware = (activityType) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(); // Skip fraud detection if user is not authenticated
            }
            const activityData = {
                userId: req.user.userId,
                activityType,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                deviceFingerprint: req.get('X-Device-Fingerprint'), // Custom header from frontend
                sessionId: req.session?.id || req.headers['x-session-id'],
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
                }
                catch (e) {
                    // Ignore invalid location data
                }
            }
            const fraudCheck = await fraud_detection_1.FraudDetection.checkActivity(activityData);
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
            req.fraudCheck = fraudCheck;
            next();
        }
        catch (error) {
            console.error('Fraud detection middleware error:', error);
            // Don't block the request if fraud detection fails
            next();
        }
    };
};
exports.fraudDetectionMiddleware = fraudDetectionMiddleware;
const logPaymentMismatch = async (userId, expectedAmount, actualAmount, paymentMethod, transactionRef) => {
    await fraud_detection_1.FraudDetection.checkPaymentMismatch(userId, expectedAmount, actualAmount, paymentMethod, { transactionRef });
};
exports.logPaymentMismatch = logPaymentMismatch;
