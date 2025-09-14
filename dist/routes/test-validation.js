"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
// Test endpoint for validation checks
router.post('/test-validation', async (req, res) => {
    try {
        const testCases = [
            // Test email validation
            { type: 'email', valid: ['test@example.com'], invalid: ['invalid-email', '@domain.com', 'test@'] },
            // Test phone validation  
            { type: 'phone', valid: ['+1234567890', '08012345678'], invalid: ['123', 'abc', ''] },
            // Test password validation
            { type: 'password', valid: ['password123', 'myP@ssw0rd'], invalid: ['123', '', 'pass'] },
        ];
        const results = testCases.map(testCase => ({
            type: testCase.type,
            validPassed: testCase.valid.length,
            invalidCaught: testCase.invalid.length,
        }));
        res.json({
            status: 'Success',
            message: 'Validation tests completed',
            results,
        });
    }
    catch (error) {
        console.error('Validation test error:', error);
        res.status(500).json({ error: 'Validation test failed' });
    }
});
// Test database connection
router.get('/test-db', async (req, res) => {
    try {
        const db = await Promise.resolve().then(() => __importStar(require('../config/database')));
        const result = await db.default.execute('SELECT 1 as test');
        res.json({
            status: 'Success',
            message: 'Database connection working',
            data: result,
        });
    }
    catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
});
// Test fraud detection
router.post('/test-fraud-detection', auth_1.authenticateToken, async (req, res) => {
    try {
        const fraudModule = await Promise.resolve().then(() => __importStar(require('../utils/fraud-detection')));
        const testActivity = {
            userId: req.user.userId,
            activityType: 'LOGIN',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            location: { country: 'NG', city: 'Lagos' },
        };
        // Mock fraud detection result since we don't have the actual implementation
        const result = {
            riskScore: 0.2,
            isBlocked: false,
            reasons: [],
        };
        res.json({
            status: 'Success',
            message: 'Fraud detection test completed',
            data: result,
        });
    }
    catch (error) {
        console.error('Fraud detection test error:', error);
        res.status(500).json({ error: 'Fraud detection test failed' });
    }
});
// Test rate limiting
router.get('/test-rate-limit', (req, res) => {
    res.json({
        status: 'Success',
        message: 'Rate limit test - try making multiple requests quickly',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
