
import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { RealTimeApiService } from '../utils/realtime-api';

const router = Router();

// Health check endpoint
router.get('/health', async (req, res) => {
  const result = await RealTimeApiService.healthCheck();
  res.status(result.success ? 200 : 500).json(result);
});

// Dashboard statistics
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  const result = await RealTimeApiService.getDashboardStats();
  res.status(result.success ? 200 : 500).json(result);
});

// User operations
router.get('/users/:id', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid user ID',
      timestamp: new Date().toISOString(),
      executionTime: 0
    });
  }

  const result = await RealTimeApiService.getUserById(userId);
  res.status(result.success ? 200 : 404).json(result);
});

router.get('/users/role/:role', authenticateToken, async (req, res) => {
  const { role } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  
  const result = await RealTimeApiService.getUsersByRole(role, limit);
  res.status(result.success ? 200 : 500).json(result);
});

// Product operations
router.get('/products/active', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  
  const result = await RealTimeApiService.getActiveProducts(limit);
  res.status(result.success ? 200 : 500).json(result);
});

router.get('/products/seller/:sellerId', async (req, res) => {
  const sellerId = parseInt(req.params.sellerId);
  if (isNaN(sellerId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid seller ID',
      timestamp: new Date().toISOString(),
      executionTime: 0
    });
  }

  const result = await RealTimeApiService.getProductsBySeller(sellerId);
  res.status(result.success ? 200 : 500).json(result);
});

// Order operations
router.get('/orders/user/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid user ID',
      timestamp: new Date().toISOString(),
      executionTime: 0
    });
  }

  const limit = parseInt(req.query.limit as string) || 50;
  
  const result = await RealTimeApiService.getOrdersByUser(userId, limit);
  res.status(result.success ? 200 : 500).json(result);
});

router.get('/orders/status/:status', authenticateToken, async (req, res) => {
  const { status } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;
  
  const result = await RealTimeApiService.getOrdersByStatus(status, limit);
  res.status(result.success ? 200 : 500).json(result);
});

// Activity monitoring
router.get('/activity/user/:userId', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid user ID',
      timestamp: new Date().toISOString(),
      executionTime: 0
    });
  }

  const hours = parseInt(req.query.hours as string) || 24;
  
  const result = await RealTimeApiService.getUserRecentActivity(userId, hours);
  res.status(result.success ? 200 : 500).json(result);
});

// Security monitoring
router.get('/security/fraud-alerts', authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  
  const result = await RealTimeApiService.getActiveFraudAlerts(limit);
  res.status(result.success ? 200 : 500).json(result);
});

export default router;
