"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
// Test email endpoint - sends a test email to verify SMTP configuration
router.post('/test-smtp', async (req, res) => {
    try {
        const { email, type = 'otp' } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address is required' });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        let result;
        if (type === 'welcome') {
            await (0, mailer_1.sendWelcomeEmail)(email, 'Test User');
            result = 'Welcome email sent successfully';
        }
        else {
            const testOTP = '123456';
            await (0, mailer_1.sendOTPEmail)(email, testOTP);
            result = 'OTP email sent successfully';
        }
        res.json({
            message: result,
            testEmail: email,
            emailService: process.env.EMAIL_SERVICE || 'gmail',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Test email error:', error);
        // Provide more specific error information
        let errorMessage = 'Failed to send test email';
        if (error instanceof Error) {
            if (error.message.includes('Invalid login')) {
                errorMessage = 'Gmail authentication failed - check EMAIL_USER and EMAIL_PASS';
            }
            else if (error.message.includes('Missing credentials')) {
                errorMessage = 'Gmail credentials not configured - set EMAIL_USER and EMAIL_PASS';
            }
            else {
                errorMessage = `SMTP Error: ${error.message}`;
            }
        }
        res.status(500).json({
            error: errorMessage,
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Test endpoint to check email configuration
router.get('/smtp-config', async (req, res) => {
    try {
        const config = {
            emailService: process.env.EMAIL_SERVICE || 'gmail',
            emailUser: process.env.EMAIL_USER ? 'Configured' : 'Not configured',
            emailPass: process.env.EMAIL_PASS ? 'Configured' : 'Not configured',
            status: 'Ready for testing'
        };
        res.json(config);
    }
    catch (error) {
        console.error('Config check error:', error);
        res.status(500).json({ error: 'Failed to check configuration' });
    }
});
exports.default = router;
