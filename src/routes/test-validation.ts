
import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { sql } from 'drizzle-orm';
import db from '../config/database';

const router = Router();

// Test endpoint for validation checks
router.post('/test-validation', async (req, res) => {
  try {
    const { validateEmail, validatePhone, validatePassword } = await import('../utils/validation');
    
    const testCases = [
      // Test email validation
      { 
        type: 'email', 
        valid: ['test@example.com', 'user@domain.co.uk', 'name.lastname@example.org'], 
        invalid: ['invalid-email', '@domain.com', 'test@', 'test.com', ''] 
      },
      // Test phone validation  
      { 
        type: 'phone', 
        valid: ['+1234567890', '08012345678', '+234-801-234-5678'], 
        invalid: ['123', 'abc', '', '12345', '+'] 
      },
      // Test password validation
      { 
        type: 'password', 
        valid: ['password123', 'myP@ssw0rd', 'securePass1'], 
        invalid: ['123', '', 'pass', '12345'] 
      },
    ];

    const results = testCases.map(testCase => {
      let validationFunction;
      
      switch (testCase.type) {
        case 'email':
          validationFunction = validateEmail;
          break;
        case 'phone':
          validationFunction = validatePhone;
          break;
        case 'password':
          validationFunction = validatePassword;
          break;
        default:
          return { type: testCase.type, error: 'Unknown validation type' };
      }

      const validResults = testCase.valid.map(value => ({
        value,
        passed: validationFunction(value),
        expected: true
      }));

      const invalidResults = testCase.invalid.map(value => ({
        value,
        passed: !validationFunction(value),
        expected: false
      }));

      const validPassed = validResults.filter(r => r.passed).length;
      const invalidCaught = invalidResults.filter(r => r.passed).length;
      const totalTests = testCase.valid.length + testCase.invalid.length;
      const totalPassed = validPassed + invalidCaught;

      return {
        type: testCase.type,
        validPassed,
        invalidCaught,
        totalTests,
        totalPassed,
        successRate: `${((totalPassed / totalTests) * 100).toFixed(1)}%`,
        details: {
          validTests: validResults,
          invalidTests: invalidResults
        }
      };
    });

    res.json({
      status: 'Success',
      message: 'Validation tests completed',
      results,
      summary: {
        totalTestCases: results.length,
        overallTests: results.reduce((sum, r) => sum + r.totalTests, 0),
        overallPassed: results.reduce((sum, r) => sum + r.totalPassed, 0)
      }
    });
  } catch (error) {
    console.error('Validation test error:', error);
    res.status(500).json({ error: 'Validation test failed' });
  }
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    
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
      activityType: 'LOGIN' as const,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      location: { country: 'NG', city: 'Lagos' },
    };

    // Use actual fraud detection implementation
    const result = await FraudDetection.checkActivity(testActivity);
    
    res.json({
      status: 'Success',
      message: 'Fraud detection test completed',
      data: {
        riskScore: result.riskScore,
        isBlocked: result.shouldBlock,
        isRisky: result.isRisky,
        alerts: result.alerts,
      },
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
