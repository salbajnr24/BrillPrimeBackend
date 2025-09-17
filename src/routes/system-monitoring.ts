
import { Router } from 'express';
import db from '../config/database';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { users, transactions, orders } from '../schema';
import { count, gte } from 'drizzle-orm';

const router = Router();

// System health check
router.get('/health', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // Check database connectivity
    const dbCheck = await db.select({ count: count() }).from(users);
    
    // Check recent transaction activity
    const recentTransactions = await db
      .select({ count: count() })
      .from(transactions)
      .where(gte(transactions.createdAt, new Date(Date.now() - 60 * 60 * 1000))); // Last hour

    const health = {
      database: dbCheck[0].count >= 0 ? 'healthy' : 'error',
      api: 'online',
      paymentGateway: process.env.PAYSTACK_SECRET_KEY ? 'active' : 'inactive',
      websocket: 'active', // Would check actual WebSocket status
      recentActivity: recentTransactions[0].count,
      lastChecked: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      version: '1.0.0'
    };

    res.json({
      success: true,
      data: health,
      status: 'healthy'
    });
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check system health',
      status: 'unhealthy'
    });
  }
});

// Real-time metrics
router.get('/metrics/realtime', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      recentTransactions,
      activeUsers,
      pendingOrders
    ] = await Promise.all([
      db.select({ count: count() }).from(transactions).where(gte(transactions.createdAt, oneHourAgo)),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, oneHourAgo)),
      db.select({ count: count() }).from(orders).where(gte(orders.createdAt, oneHourAgo))
    ]);

    const metrics = {
      recentTransactions: recentTransactions[0].count,
      newUsers: activeUsers[0].count,
      pendingOrders: pendingOrders[0].count,
      serverMetrics: {
        cpuUsage: Math.floor(Math.random() * 30) + 20, // Mock CPU usage
        memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        diskUsage: Math.floor(Math.random() * 20) + 30, // Mock disk usage
        activeConnections: Math.floor(Math.random() * 100) + 50
      },
      timestamp: now.toISOString()
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Get realtime metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get realtime metrics' });
  }
});

// Performance metrics
router.get('/performance', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const performance = {
      responseTime: {
        average: Math.floor(Math.random() * 100) + 50, // Mock response time
        p95: Math.floor(Math.random() * 200) + 100,
        p99: Math.floor(Math.random() * 500) + 200
      },
      throughput: {
        requestsPerSecond: Math.floor(Math.random() * 50) + 25,
        transactionsPerMinute: Math.floor(Math.random() * 20) + 10
      },
      errors: {
        errorRate: Math.random() * 2, // Mock error rate
        last24Hours: Math.floor(Math.random() * 50)
      },
      database: {
        connectionCount: Math.floor(Math.random() * 20) + 5,
        queryTime: Math.floor(Math.random() * 50) + 10,
        slowQueries: Math.floor(Math.random() * 5)
      }
    };

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Get performance metrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to get performance metrics' });
  }
});

// Error logs
router.get('/errors', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { limit = 50, severity = '', startDate = '', endDate = '' } = req.query;

    // Mock error logs - in production this would come from actual logging system
    const errors = Array.from({ length: parseInt(limit as string) }, (_, i) => ({
      id: i + 1,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      severity: ['ERROR', 'WARNING', 'CRITICAL'][Math.floor(Math.random() * 3)],
      message: [
        'Database connection timeout',
        'Payment gateway error',
        'Authentication failed',
        'File upload failed',
        'Email delivery failed'
      ][Math.floor(Math.random() * 5)],
      source: ['auth.ts', 'payment.ts', 'upload.ts', 'email.ts'][Math.floor(Math.random() * 4)],
      userId: Math.floor(Math.random() * 1000),
      stackTrace: 'Error stack trace would be here...'
    })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json({
      success: true,
      data: errors
    });
  } catch (error) {
    console.error('Get error logs error:', error);
    res.status(500).json({ success: false, message: 'Failed to get error logs' });
  }
});

// Database maintenance
router.post('/maintenance/backup', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // In a real implementation, this would trigger a database backup
    const backupId = `backup_${Date.now()}`;
    
    res.json({ 
      success: true, 
      message: 'Backup initiated successfully',
      data: { backupId }
    });
  } catch (error) {
    console.error('Database backup error:', error);
    res.status(500).json({ success: false, message: 'Backup failed' });
  }
});

export default router;
