
import { Router } from 'express';
import { authenticateToken } from '../utils/auth';
import { AutoAssignmentService } from '../services/auto-assignment';
import { db } from '../config/database';
import { orders } from '../schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Request driver assignment for an order
router.post('/:orderId/request-assignment', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, parseInt(orderId)))
      .limit(1);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify user owns the order
    if (order.customerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order already has a driver
    if (order.driverId) {
      return res.status(400).json({
        success: false,
        message: 'Order already has an assigned driver'
      });
    }

    // Parse delivery location
    let deliveryLocation;
    try {
      if (typeof order.deliveryAddress === 'string') {
        deliveryLocation = JSON.parse(order.deliveryAddress);
      } else {
        deliveryLocation = order.deliveryAddress;
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid delivery address format'
      });
    }

    if (!deliveryLocation.latitude || !deliveryLocation.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Delivery coordinates are required for auto-assignment'
      });
    }

    // Attempt auto-assignment
    const result = await AutoAssignmentService.assignBestDriver(
      order.id,
      {
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude,
        urgentOrder: order.orderType === 'URGENT'
      }
    );

    if (result) {
      res.json({
        success: true,
        message: 'Driver assigned successfully',
        assignment: {
          orderId: result.assignedOrder?.id,
          driverId: result.driverId,
          distance: result.distance,
          score: result.driverScore
        }
      });
    } else {
      res.json({
        success: false,
        message: 'No available drivers found in your area. We will notify you when a driver becomes available.'
      });
    }
  } catch (error: any) {
    console.error('Request assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request driver assignment'
    });
  }
});

// Get assignment status for an order
router.get('/:orderId/assignment-status', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, parseInt(orderId)))
      .limit(1);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify access
    if (order.customerId !== userId && order.driverId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const assignmentStatus = {
      hasDriver: !!order.driverId,
      status: order.status,
      driverId: order.driverId,
      assignedAt: order.acceptedAt
    };

    res.json({
      success: true,
      assignment: assignmentStatus
    });
  } catch (error: any) {
    console.error('Get assignment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assignment status'
    });
  }
});

export default router;
