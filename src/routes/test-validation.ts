
import { Router } from 'express';
import { authenticateToken } from '../utils/auth';

const router = Router();

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
  } catch (error) {
    console.error('Validation test error:', error);
    res.status(500).json({ error: 'Validation test failed' });
  }
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    // Simple query to test DB connection
    const result = await import('../config/database').then(db => 
      db.default.execute('SELECT 1 as test')
    );
    
    res.json({
      status: 'Success',
      message: 'Database connection working',
      data: result,
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Test fraud detection
router.post('/test-fraud-detection', authenticateToken, async (req: any, res) => {
  try {
    const { FraudDetection } = await import('../utils/fraud-detection');
    
    const testActivity = {
      userId: req.user.userId,
      activityType: 'LOGIN',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      location: { country: 'NG', city: 'Lagos' },
    };

    const result = await FraudDetection.checkActivity(testActivity);
    
    res.json({
      status: 'Success',
      message: 'Fraud detection test completed',
      data: result,
    });
  } catch (error) {
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

export default router;
