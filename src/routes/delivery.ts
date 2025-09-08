import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import db from '../config/database';
import { 
  deliveryRequests, 
  users, 
  driverProfiles,
  orders
} from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { createNotification } from './notifications';

const router = Router();

// Create delivery request
router.post('/request', authenticateToken, async (req, res) => {
  try {
    const customerId = (req as any).user.userId;
    const {
      merchantId,
      orderId,
      deliveryType,
      cargoValue,
      requiresPremiumDriver,
      pickupAddress,
      deliveryAddress,
      estimatedDistance,
      estimatedDuration,
      deliveryFee,
      scheduledPickupTime,
      specialInstructions,
    } = req.body;

    if (!deliveryType || !pickupAddress || !deliveryAddress || !deliveryFee) {
      return res.status(400).json({ error: 'Required fields: deliveryType, pickupAddress, deliveryAddress, deliveryFee' });
    }

    // Generate tracking number
    const trackingNumber = `BP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const newDelivery = await db.insert(deliveryRequests).values({
      customerId,
      merchantId,
      orderId,
      deliveryType: deliveryType as any,
      cargoValue: cargoValue?.toString() || '0',
      requiresPremiumDriver: requiresPremiumDriver || false,
      pickupAddress,
      deliveryAddress,
      estimatedDistance: estimatedDistance?.toString(),
      estimatedDuration,
      deliveryFee: deliveryFee.toString(),
      scheduledPickupTime: scheduledPickupTime ? new Date(scheduledPickupTime) : null,
      specialInstructions,
      trackingNumber,
    }).returning();

    // Find available drivers and send notifications
    try {
      const availableDrivers = await db.select({
        userId: users.id,
      })
        .from(users)
        .leftJoin(driverProfiles, eq(users.id, driverProfiles.userId))
        .where(and(
          eq(users.role, 'DRIVER'),
          eq(driverProfiles.isAvailable, true),
          eq(driverProfiles.isActive, true)
        ))
        .limit(10); // Limit to 10 drivers for now

      // Send delivery request notifications to available drivers
      for (const driver of availableDrivers) {
        await createNotification({
          userId: driver.userId,
          userRole: 'DRIVER',
          title: 'New Delivery Request',
          message: `${deliveryType} delivery - ₦${deliveryFee} (${estimatedDistance || 'TBD'}km)`,
          type: 'DELIVERY_REQUEST',
          relatedId: newDelivery[0].id,
          priority: 'HIGH',
          actionUrl: `/delivery/requests/${newDelivery[0].id}`,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Expires in 30 minutes
        });
      }
    } catch (notificationError) {
      console.error('Failed to create delivery request notifications:', notificationError);
      // Don't fail the delivery creation if notification creation fails
    }

    res.status(201).json({
      message: 'Delivery request created successfully',
      delivery: newDelivery[0],
    });
  } catch (error) {
    console.error('Create delivery request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available delivery requests for drivers
router.get('/available', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { deliveryType, maxDistance = 50 } = req.query;

    // Get driver profile to check capabilities
    const driverProfile = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId));

    if (driverProfile.length === 0) {
      return res.status(400).json({ error: 'Driver profile not found. Please complete your profile first.' });
    }

    const driver = driverProfile[0];

    let whereConditions = [eq(deliveryRequests.status, 'PENDING')];

    // Filter by delivery type if driver has service type restrictions
    if (deliveryType) {
      whereConditions.push(eq(deliveryRequests.deliveryType, deliveryType as any));
    }

    // Filter by premium driver requirement
    if (driver.driverTier === 'STANDARD') {
      whereConditions.push(eq(deliveryRequests.requiresPremiumDriver, false));
    }

    const availableDeliveries = await db.select({
      id: deliveryRequests.id,
      deliveryType: deliveryRequests.deliveryType,
      cargoValue: deliveryRequests.cargoValue,
      requiresPremiumDriver: deliveryRequests.requiresPremiumDriver,
      pickupAddress: deliveryRequests.pickupAddress,
      deliveryAddress: deliveryRequests.deliveryAddress,
      estimatedDistance: deliveryRequests.estimatedDistance,
      estimatedDuration: deliveryRequests.estimatedDuration,
      deliveryFee: deliveryRequests.deliveryFee,
      scheduledPickupTime: deliveryRequests.scheduledPickupTime,
      specialInstructions: deliveryRequests.specialInstructions,
      trackingNumber: deliveryRequests.trackingNumber,
      createdAt: deliveryRequests.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
      },
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.customerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(20);

    res.json({
      deliveries: availableDeliveries,
      driverInfo: {
        tier: driver.driverTier,
        canHandlePremium: driver.driverTier === 'PREMIUM',
        serviceTypes: driver.serviceTypes,
        maxCargoValue: driver.maxCargoValue,
      },
    });
  } catch (error) {
    console.error('Get available deliveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept delivery request
router.post('/:id/accept', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = (req as any).user.userId;

    // Check if delivery is still available
    const delivery = await db.select().from(deliveryRequests).where(and(
      eq(deliveryRequests.id, id),
      eq(deliveryRequests.status, 'PENDING')
    ));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery request not found or already assigned' });
    }

    // Check driver qualifications
    const driverProfile = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId));

    if (driverProfile.length === 0) {
      return res.status(400).json({ error: 'Driver profile not found' });
    }

    const driver = driverProfile[0];
    const deliveryRequest = delivery[0];

    // Check if delivery requires premium driver
    if (deliveryRequest.requiresPremiumDriver && driver.driverTier !== 'PREMIUM') {
      return res.status(403).json({ error: 'This delivery requires a premium driver' });
    }

    // Update delivery request
    const updatedDelivery = await db.update(deliveryRequests)
      .set({
        driverId,
        status: 'ASSIGNED',
        updatedAt: new Date(),
      })
      .where(eq(deliveryRequests.id, id))
      .returning();

    // Notify customer and potentially merchant about driver assignment
    try {
      if (updatedDelivery[0].customerId) {
        await createNotification({
          userId: updatedDelivery[0].customerId,
          userRole: 'CONSUMER',
          title: 'Driver Assigned',
          message: `Your delivery is now assigned to a driver.`,
          type: 'DELIVERY_UPDATE',
          relatedId: id,
          priority: 'MEDIUM',
          actionUrl: `/delivery/${id}/track`,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create driver assigned notification:', notificationError);
    }

    res.json({
      message: 'Delivery request accepted successfully',
      delivery: updatedDelivery[0],
    });
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update delivery status
router.put('/:id/status', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const { id: deliveryId } = req.params;
    const driverId = (req as any).user.userId;
    const { status, actualPickupTime, actualDeliveryTime } = req.body;

    const validStatuses = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if delivery belongs to the driver
    const existingDelivery = await db.select().from(deliveryRequests).where(and(
      eq(deliveryRequests.id, deliveryId),
      eq(deliveryRequests.driverId, driverId)
    ));

    if (existingDelivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or you are not assigned to it' });
    }

    const updatedDelivery = await db.update(deliveryRequests)
      .set({ 
        status: status as any,
        ...(status === 'PICKED_UP' && { actualPickupTime: new Date() }),
        ...(status === 'DELIVERED' && { actualDeliveryTime: new Date() }),
      })
      .where(and(
        eq(deliveryRequests.id, deliveryId),
        eq(deliveryRequests.driverId, driverId)
      ))
      .returning();

    if (updatedDelivery.length === 0) {
      return res.status(404).json({ error: 'Delivery request not found or unauthorized' });
    }

    // Create notifications for delivery status updates
    const statusMessages = {
      ASSIGNED: 'A driver has been assigned to your delivery',
      PICKED_UP: 'Your package has been picked up and is on the way',
      IN_TRANSIT: 'Your package is in transit',
      DELIVERED: 'Your package has been delivered successfully',
      CANCELLED: 'Your delivery has been cancelled'
    };

    try {
      // Notify customer about delivery status
      if (updatedDelivery[0].customerId) {
        await createNotification({
          userId: updatedDelivery[0].customerId,
          userRole: 'CONSUMER',
          title: 'Delivery Update',
          message: statusMessages[status as keyof typeof statusMessages] || `Your delivery status: ${status}`,
          type: 'DELIVERY_UPDATE',
          relatedId: deliveryId,
          priority: status === 'DELIVERED' || status === 'CANCELLED' ? 'HIGH' : 'MEDIUM',
          actionUrl: `/delivery/${deliveryId}/track`,
        });
      }

      // Notify merchant about delivery status
      if (updatedDelivery[0].merchantId && (status === 'DELIVERED' || status === 'CANCELLED')) {
        await createNotification({
          userId: updatedDelivery[0].merchantId,
          userRole: 'MERCHANT',
          title: 'Delivery Update',
          message: status === 'DELIVERED' 
            ? 'Your order has been delivered successfully'
            : 'Delivery has been cancelled',
          type: 'DELIVERY',
          relatedId: deliveryId,
          priority: 'HIGH',
          actionUrl: `/delivery/${deliveryId}`,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create delivery status notification:', notificationError);
      // Don't fail the delivery update if notification creation fails
    }

    res.json({
      status: 'Success',
      message: 'Delivery status updated successfully',
      data: updatedDelivery[0],
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get driver's deliveries
router.get('/my-deliveries', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(deliveryRequests.driverId, driverId)];
    if (status) {
      whereConditions.push(eq(deliveryRequests.status, status as any));
    }

    const driverDeliveries = await db.select({
      id: deliveryRequests.id,
      deliveryType: deliveryRequests.deliveryType,
      cargoValue: deliveryRequests.cargoValue,
      pickupAddress: deliveryRequests.pickupAddress,
      deliveryAddress: deliveryRequests.deliveryAddress,
      estimatedDistance: deliveryRequests.estimatedDistance,
      deliveryFee: deliveryRequests.deliveryFee,
      status: deliveryRequests.status,
      scheduledPickupTime: deliveryRequests.scheduledPickupTime,
      actualPickupTime: deliveryRequests.actualPickupTime,
      actualDeliveryTime: deliveryRequests.actualDeliveryTime,
      trackingNumber: deliveryRequests.trackingNumber,
      createdAt: deliveryRequests.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
      },
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.customerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(deliveryRequests.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      deliveries: driverDeliveries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: driverDeliveries.length,
      },
    });
  } catch (error) {
    console.error('Get driver deliveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Track delivery by tracking number (public)
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const delivery = await db.select({
      id: deliveryRequests.id,
      deliveryType: deliveryRequests.deliveryType,
      pickupAddress: deliveryRequests.pickupAddress,
      deliveryAddress: deliveryRequests.deliveryAddress,
      status: deliveryRequests.status,
      scheduledPickupTime: deliveryRequests.scheduledPickupTime,
      actualPickupTime: deliveryRequests.actualPickupTime,
      estimatedDeliveryTime: deliveryRequests.estimatedDeliveryTime,
      actualDeliveryTime: deliveryRequests.actualDeliveryTime,
      trackingNumber: deliveryRequests.trackingNumber,
      createdAt: deliveryRequests.createdAt,
      driver: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
      },
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.driverId, users.id))
      .where(eq(deliveryRequests.trackingNumber, trackingNumber));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json(delivery[0]);
  } catch (error) {
    console.error('Track delivery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get delivery statistics for drivers
router.get('/stats', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;

    const stats = await db.select({
      totalDeliveries: sql<number>`count(*)`.mapWith(Number),
      completedDeliveries: sql<number>`count(*) filter (where status = 'DELIVERED')`.mapWith(Number),
      totalEarnings: sql<string>`sum(${deliveryRequests.deliveryFee})`,
    })
      .from(deliveryRequests)
      .where(eq(deliveryRequests.driverId, driverId));

    const driverProfile = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId));

    res.json({
      stats: stats[0],
      profile: driverProfile[0],
    });
  } catch (error) {
    console.error('Get delivery stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update delivery location (for drivers)
router.put('/:id/location', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const driverId = (req as any).user.userId;
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Verify this driver is assigned to the delivery
    const delivery = await db.select()
      .from(deliveryRequests)
      .where(and(
        eq(deliveryRequests.id, Number(deliveryId)),
        eq(deliveryRequests.driverId, driverId)
      ));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or not assigned to you' });
    }

    // Update delivery with current location
    const updatedDelivery = await db.update(deliveryRequests)
      .set({
        currentLatitude: latitude.toString(),
        currentLongitude: longitude.toString(),
        currentAddress: address || null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryRequests.id, Number(deliveryId)))
      .returning();

    res.json({
      message: 'Location updated successfully',
      delivery: updatedDelivery[0],
    });
  } catch (error) {
    console.error('Update delivery location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark delivery as picked up
router.put('/:id/pickup', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const driverId = (req as any).user.userId;
    const { pickupPhotoUrl, notes } = req.body;

    // Verify this driver is assigned to the delivery
    const delivery = await db.select()
      .from(deliveryRequests)
      .where(and(
        eq(deliveryRequests.id, Number(deliveryId)),
        eq(deliveryRequests.driverId, driverId),
        eq(deliveryRequests.status, 'ASSIGNED')
      ));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found, not assigned to you, or not in correct status' });
    }

    // Update delivery status to picked up
    const updatedDelivery = await db.update(deliveryRequests)
      .set({
        status: 'PICKED_UP',
        pickupTime: new Date(),
        pickupPhotoUrl,
        pickupNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(deliveryRequests.id, Number(deliveryId)))
      .returning();

    res.json({
      message: 'Delivery marked as picked up',
      delivery: updatedDelivery[0],
    });
  } catch (error) {
    console.error('Mark delivery pickup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark delivery as delivered
router.put('/:id/deliver', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const driverId = (req as any).user.userId;
    const { deliveryPhotoUrl, recipientName, recipientSignature, notes } = req.body;

    // Verify this driver is assigned to the delivery
    const delivery = await db.select()
      .from(deliveryRequests)
      .where(and(
        eq(deliveryRequests.id, Number(deliveryId)),
        eq(deliveryRequests.driverId, driverId),
        eq(deliveryRequests.status, 'PICKED_UP')
      ));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found, not assigned to you, or not picked up yet' });
    }

    // Update delivery status to delivered
    const updatedDelivery = await db.update(deliveryRequests)
      .set({
        status: 'DELIVERED',
        deliveryTime: new Date(),
        deliveryPhotoUrl,
        recipientName,
        recipientSignature,
        deliveryNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(deliveryRequests.id, Number(deliveryId)))
      .returning();

    // Update associated order status if linked
    if (delivery[0].orderId) {
      await db.update(orders)
        .set({ status: 'delivered' })
        .where(eq(orders.id, Number(delivery[0].orderId)));
    }

    res.json({
      message: 'Delivery completed successfully',
      delivery: updatedDelivery[0],
    });
  } catch (error) {
    console.error('Mark delivery completed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get delivery tracking information (public)
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    const delivery = await db.select({
      delivery: deliveryRequests,
      driver: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        profilePicture: users.profilePicture,
      },
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.driverId, users.id))
      .where(eq(deliveryRequests.trackingNumber, trackingNumber));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Tracking number not found' });
    }

    const deliveryData = delivery[0];

    res.json({
      trackingNumber: deliveryData.delivery.trackingNumber,
      status: deliveryData.delivery.status,
      deliveryType: deliveryData.delivery.deliveryType,
      pickupAddress: deliveryData.delivery.pickupAddress,
      deliveryAddress: deliveryData.delivery.deliveryAddress,
      estimatedDuration: deliveryData.delivery.estimatedDuration,
      currentLocation: deliveryData.delivery.currentLatitude && deliveryData.delivery.currentLongitude ? {
        latitude: parseFloat(deliveryData.delivery.currentLatitude),
        longitude: parseFloat(deliveryData.delivery.currentLongitude),
        address: deliveryData.delivery.currentAddress,
      } : null,
      driver: deliveryData.driver ? {
        name: deliveryData.driver.fullName,
        phone: deliveryData.driver.phone,
        profilePicture: deliveryData.driver.profilePicture,
      } : null,
      timeline: {
        createdAt: deliveryData.delivery.createdAt,
        assignedAt: deliveryData.delivery.assignedAt,
        pickupTime: deliveryData.delivery.pickupTime,
        deliveryTime: deliveryData.delivery.deliveryTime,
      },
      proofOfDelivery: deliveryData.delivery.status === 'DELIVERED' ? {
        deliveryPhotoUrl: deliveryData.delivery.deliveryPhotoUrl,
        recipientName: deliveryData.delivery.recipientName,
        deliveryNotes: deliveryData.delivery.deliveryNotes,
      } : null,
    });
  } catch (error) {
    console.error('Track delivery error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get driver earnings
router.get('/earnings', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    let whereConditions = [
      eq(deliveryRequests.driverId, driverId),
      eq(deliveryRequests.status, 'DELIVERED')
    ];

    if (startDate) {
      whereConditions.push(sql`${deliveryRequests.actualDeliveryTime} >= ${new Date(startDate as string)}`);
    }
    if (endDate) {
      whereConditions.push(sql`${deliveryRequests.actualDeliveryTime} <= ${new Date(endDate as string)}`);
    }

    // Get earnings summary
    const earningsSummary = await db.select({
      totalEarnings: sql<string>`sum(${deliveryRequests.deliveryFee})`,
      totalDeliveries: sql<number>`count(*)`.mapWith(Number),
      averageEarningPerDelivery: sql<string>`avg(${deliveryRequests.deliveryFee})`,
    })
      .from(deliveryRequests)
      .where(and(...whereConditions));

    // Get detailed earnings
    const offset = (Number(page) - 1) * Number(limit);
    const detailedEarnings = await db.select({
      id: deliveryRequests.id,
      deliveryFee: deliveryRequests.deliveryFee,
      deliveryType: deliveryRequests.deliveryType,
      trackingNumber: deliveryRequests.trackingNumber,
      actualDeliveryTime: deliveryRequests.actualDeliveryTime,
      customer: {
        fullName: users.fullName,
      },
    })
      .from(deliveryRequests)
      .leftJoin(users, eq(deliveryRequests.customerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(deliveryRequests.actualDeliveryTime))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Earnings fetched successfully',
      data: {
        summary: earningsSummary[0],
        earnings: detailedEarnings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
        },
      },
    });
  } catch (error) {
    console.error('Get driver earnings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request payout
router.post('/request-payout', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { amount, bankAccount, accountNumber, bankCode } = req.body;

    if (!amount || !bankAccount || !accountNumber || !bankCode) {
      return res.status(400).json({ 
        error: 'Amount, bank account details are required' 
      });
    }

    // Get driver's available balance
    const availableEarnings = await db.select({
      totalEarnings: sql<string>`sum(${deliveryRequests.deliveryFee})`,
    })
      .from(deliveryRequests)
      .where(and(
        eq(deliveryRequests.driverId, driverId),
        eq(deliveryRequests.status, 'DELIVERED')
      ));

    const totalEarnings = parseFloat(availableEarnings[0]?.totalEarnings || '0');

    if (amount > totalEarnings) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${totalEarnings}` 
      });
    }

    // Create payout request (In production, this would be stored in a payouts table)
    const payoutRequest = {
      driverId,
      amount,
      bankAccount,
      accountNumber,
      bankCode,
      status: 'PENDING',
      requestedAt: new Date(),
      referenceId: `PAYOUT-${Date.now()}-${driverId}`,
    };

    // Notify driver of payout request confirmation
    try {
      await createNotification({
        userId: driverId,
        userRole: 'DRIVER',
        title: 'Payout Request Submitted',
        message: `Your payout request of ₦${amount} has been submitted and is pending confirmation.`,
        type: 'PAYOUT_CONFIRMATION',
        relatedId: payoutRequest.referenceId,
        priority: 'HIGH',
        actionUrl: '/earnings',
      });
    } catch (notificationError) {
      console.error('Failed to create payout confirmation notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Payout request submitted successfully',
      data: payoutRequest,
    });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get delivery route (basic implementation)
router.get('/:id/route', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = (req as any).user.userId;

    // Get delivery details
    const delivery = await db.select().from(deliveryRequests).where(and(
      eq(deliveryRequests.id, id),
      eq(deliveryRequests.driverId, driverId)
    ));

    if (delivery.length === 0) {
      return res.status(404).json({ error: 'Delivery not found or not assigned to you' });
    }

    const deliveryData = delivery[0];

    // Basic route information (in production, integrate with Google Maps/Mapbox)
    const routeInfo = {
      deliveryId: id,
      pickupAddress: deliveryData.pickupAddress,
      deliveryAddress: deliveryData.deliveryAddress,
      estimatedDistance: deliveryData.estimatedDistance,
      estimatedDuration: deliveryData.estimatedDuration,
      currentLocation: deliveryData.currentLatitude && deliveryData.currentLongitude ? {
        latitude: parseFloat(deliveryData.currentLatitude),
        longitude: parseFloat(deliveryData.currentLongitude),
      } : null,
      optimizedRoute: [
        { step: 1, instruction: `Head to pickup location: ${deliveryData.pickupAddress}` },
        { step: 2, instruction: `Collect package` },
        { step: 3, instruction: `Navigate to delivery location: ${deliveryData.deliveryAddress}` },
        { step: 4, instruction: `Complete delivery` },
      ],
    };

    res.json({
      status: 'Success',
      message: 'Route information fetched successfully',
      data: routeInfo,
    });
  } catch (error) {
    console.error('Get delivery route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add delivery review/feedback (Consumer side)
router.post('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = (req as any).user.userId;
    const { rating, feedback, driverRating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if delivery belongs to the customer and is delivered
    const existingDelivery = await db.select().from(deliveryRequests).where(and(
      eq(deliveryRequests.id, id),
      eq(deliveryRequests.customerId, customerId),
      eq(deliveryRequests.status, 'DELIVERED')
    ));

    if (existingDelivery.length === 0) {
      return res.status(404).json({ 
        error: 'Delivery not found, not yours, or not completed yet' 
      });
    }

    // Store review (in production, you'd have a separate delivery_reviews table)
    const reviewData = {
      deliveryId: id,
      customerId,
      deliveryRating: rating,
      driverRating: driverRating || rating,
      feedback: feedback || '',
      reviewDate: new Date(),
    };

    // Notify driver about the review
    try {
      if (existingDelivery[0].driverId) {
        await createNotification({
          userId: existingDelivery[0].driverId,
          userRole: 'DRIVER',
          title: 'New Delivery Review',
          message: `You received a new review for delivery ID ${id}.`,
          type: 'DELIVERY_REVIEW',
          relatedId: id,
          priority: 'MEDIUM',
          actionUrl: `/delivery/${id}`,
        });
      }
    } catch (notificationError) {
      console.error('Failed to create delivery review notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Delivery review submitted successfully',
      data: reviewData,
    });
  } catch (error) {
    console.error('Submit delivery review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;