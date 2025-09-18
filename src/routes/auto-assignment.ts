
import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { orders, deliveryRequests, driverProfiles, users } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { AutoAssignmentService, autoAssignmentService } from '../services/auto-assignment';

const router = Router();

// Configure auto-assignment settings (admin only)
router.post('/settings', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { 
      maxDistance, 
      maxAssignments, 
      preferredRating, 
      requireActiveStatus, 
      considerTier 
    } = req.body;

    // In a real implementation, you would store these settings in database
    const settings = {
      maxDistance: maxDistance || 10,
      maxAssignments: maxAssignments || 3,
      preferredRating: preferredRating || 4.0,
      requireActiveStatus: requireActiveStatus !== false,
      considerTier: considerTier !== false,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      message: 'Auto-assignment settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Configure auto-assignment settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure auto-assignment settings'
    });
  }
});

// Get auto-assignment settings (admin only)
router.get('/settings', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    // In a real implementation, you would fetch from database
    const settings = {
      maxDistance: 10,
      maxAssignments: 3,
      preferredRating: 4.0,
      requireActiveStatus: true,
      considerTier: true
    };

    res.json({
      success: true,
      message: 'Auto-assignment settings retrieved successfully',
      data: settings
    });
  } catch (error) {
    console.error('Get auto-assignment settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get auto-assignment settings'
    });
  }
});

// Get available drivers for assignment
router.get('/drivers', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 15, maxDrivers = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const deliveryLocation = {
      latitude: parseFloat(latitude as string),
      longitude: parseFloat(longitude as string)
    };

    const availableDrivers = AutoAssignmentService.getAvailableDriversNear(
      deliveryLocation,
      Number(maxDistance),
      Number(maxDrivers)
    );

    res.json({
      success: true,
      message: 'Available drivers retrieved successfully',
      data: {
        drivers: availableDrivers,
        count: availableDrivers.length,
        searchRadius: maxDistance,
        location: deliveryLocation
      }
    });
  } catch (error) {
    console.error('Get available drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available drivers'
    });
  }
});

// Manually assign a delivery to a driver
router.post('/assign/:deliveryId', authenticateToken, authorizeRoles('ADMIN', 'MERCHANT'), async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { driverId, notes } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required'
      });
    }

    // Get delivery details
    const delivery = await db.select().from(deliveryRequests).where(eq(deliveryRequests.id, deliveryId));

    if (delivery.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Delivery request not found'
      });
    }

    // Check if driver is available
    const driver = await db.select().from(driverProfiles).where(eq(driverProfiles.id, driverId));

    if (driver.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    if (!driver[0].isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not available for assignment'
      });
    }

    // Assign driver to delivery
    const updatedDelivery = await db.update(deliveryRequests)
      .set({
        driverId: driver[0].userId,
        status: 'ASSIGNED',
        updatedAt: new Date()
      })
      .where(eq(deliveryRequests.id, deliveryId))
      .returning();

    // Mark driver as busy
    await db.update(driverProfiles)
      .set({
        isAvailable: false,
        updatedAt: new Date()
      })
      .where(eq(driverProfiles.id, driverId));

    res.json({
      success: true,
      message: 'Driver assigned to delivery successfully',
      data: {
        delivery: updatedDelivery[0],
        assignedDriver: driver[0],
        notes
      }
    });
  } catch (error) {
    console.error('Manual assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver to delivery'
    });
  }
});

// Get deliveries assigned to a driver
router.get('/assignments/driver/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(deliveryRequests.driverId, driverId)];
    if (status) {
      whereConditions.push(eq(deliveryRequests.status, status as any));
    }

    const assignments = await db.select({
      id: deliveryRequests.id,
      deliveryType: deliveryRequests.deliveryType,
      pickupAddress: deliveryRequests.pickupAddress,
      deliveryAddress: deliveryRequests.deliveryAddress,
      deliveryFee: deliveryRequests.deliveryFee,
      status: deliveryRequests.status,
      scheduledPickupTime: deliveryRequests.scheduledPickupTime,
      createdAt: deliveryRequests.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone
      }
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.customerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      success: true,
      message: 'Driver assignments retrieved successfully',
      data: {
        assignments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: assignments.length
        }
      }
    });
  } catch (error) {
    console.error('Get driver assignments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get driver assignments'
    });
  }
});

// Get driver assigned to a delivery
router.get('/assignments/delivery/:deliveryId', authenticateToken, async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const assignment = await db.select({
      delivery: {
        id: deliveryRequests.id,
        deliveryType: deliveryRequests.deliveryType,
        pickupAddress: deliveryRequests.pickupAddress,
        deliveryAddress: deliveryRequests.deliveryAddress,
        status: deliveryRequests.status,
        estimatedDistance: deliveryRequests.estimatedDistance,
        deliveryFee: deliveryRequests.deliveryFee
      },
      driver: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        profilePicture: users.profilePicture,
        rating: driverProfiles.rating,
        vehicleType: driverProfiles.vehicleType,
        vehiclePlate: driverProfiles.vehiclePlate
      }
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.driverId, users.id))
      .leftJoin(driverProfiles, eq(users.id, driverProfiles.userId))
      .where(eq(deliveryRequests.id, deliveryId));

    if (assignment.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Delivery assignment not found'
      });
    }

    res.json({
      success: true,
      message: 'Delivery assignment retrieved successfully',
      data: assignment[0]
    });
  } catch (error) {
    console.error('Get delivery assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery assignment'
    });
  }
});

// Request driver assignment for an order
router.post('/:orderId/request-assignment', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryLocation } = req.body;
    const userId = (req as any).user?.userId;

    // Validate order exists and belongs to user
    const order = await db.select().from(orders).where(eq(orders.id, orderId));

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user has permission (buyer or seller)
    if (order[0].buyerId !== userId && order[0].sellerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to request assignment for this order'
      });
    }

    if (!deliveryLocation || !deliveryLocation.latitude || !deliveryLocation.longitude) {
      return res.status(400).json({
        success: false,
        message: 'Delivery coordinates are required for auto-assignment'
      });
    }

    // Attempt auto-assignment
    const result = await AutoAssignmentService.assignBestDriver(
      parseInt(orderId),
      {
        latitude: deliveryLocation.latitude,
        longitude: deliveryLocation.longitude,
        urgentOrder: order[0].status === 'urgent'
      }
    );

    if (result) {
      res.json({
        success: true,
        message: 'Driver assigned successfully',
        assignment: {
          orderId: result.assignedOrder?.orderId,
          driverId: result.driverId,
          distance: result.distance,
          estimatedArrival: result.estimatedArrival,
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
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get order with driver assignment
    const orderWithDriver = await db.select({
      order: {
        id: orders.id,
        status: orders.status,
        driverId: orders.driverId
      },
      driver: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        profilePicture: users.profilePicture,
        rating: driverProfiles.rating,
        vehicleType: driverProfiles.vehicleType,
        vehiclePlate: driverProfiles.vehiclePlate
      }
    })
      .from(orders)
      .leftJoin(users, eq(orders.driverId, users.id))
      .leftJoin(driverProfiles, eq(users.id, driverProfiles.userId))
      .where(eq(orders.id, orderId));

    if (orderWithDriver.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const data = orderWithDriver[0];
    const assignmentStatus = {
      orderId,
      isAssigned: !!data.order.driverId,
      status: data.order.status,
      driver: data.order.driverId ? data.driver : null
    };

    res.json({
      success: true,
      message: 'Assignment status retrieved successfully',
      data: assignmentStatus
    });
  } catch (error) {
    console.error('Get assignment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assignment status'
    });
  }
});

// Get assignment statistics (admin only)
router.get('/stats', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const stats = AutoAssignmentService.getAssignmentStats();
    
    // Get additional stats from database
    const [totalAssignments] = await db.select({
      total: db.select().from(deliveryRequests).where(eq(deliveryRequests.status, 'ASSIGNED'))
    });

    const [pendingAssignments] = await db.select({
      pending: db.select().from(deliveryRequests).where(eq(deliveryRequests.status, 'PENDING'))
    });

    res.json({
      success: true,
      message: 'Assignment statistics retrieved successfully',
      data: {
        ...stats,
        totalActiveAssignments: totalAssignments?.total || 0,
        pendingAssignments: pendingAssignments?.pending || 0,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Get assignment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get assignment statistics'
    });
  }
});

export default router;
