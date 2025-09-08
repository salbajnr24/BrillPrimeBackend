export interface FraudCheckResult {
    isRisky: boolean;
    riskScore: number;
    alerts: string[];
    shouldBlock: boolean;
}
export interface ActivityData {
    userId: number;
    activityType: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    location?: {
        country?: string;
        city?: string;
        lat?: number;
        lng?: number;
    };
    sessionId?: string;
    metadata?: any;
}
export declare class FraudDetection {
    private static readonly RISK_THRESHOLDS;
    private static readonly VELOCITY_LIMITS;
    static checkActivity(activityData: ActivityData): Promise<FraudCheckResult>;
    private static checkBlacklist;
    private static checkVelocity;
    private static checkLocationAnomaly;
    private static checkDeviceAnomaly;
    private static checkUserBehavior;
    private static logActivity;
    private static createFraudAlert;
    static addToBlacklist(entityType: string, entityValue: string, reason: string, addedBy: number, expiresAt?: Date): Promise<void>;
    static checkPaymentMismatch(userId: number, expectedAmount: number, actualAmount: number, paymentMethod: string, metadata?: any): Promise<void>;
}
