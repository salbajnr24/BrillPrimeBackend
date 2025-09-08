"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const notifications_1 = require("./notifications");
const router = (0, express_1.Router)();
// Create delivery request
router.post('/request', auth_1.authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.userId;
        const { merchantId, orderId, deliveryType, cargoValue, requiresPremiumDriver, pickupAddress, deliveryAddress, estimatedDistance, estimatedDuration, deliveryFee, scheduledPickupTime, specialInstructions, } = req.body;
        if (!deliveryType || !pickupAddress || !deliveryAddress || !deliveryFee) {
            return res.status(400).json({ error: 'Required fields: deliveryType, pickupAddress, deliveryAddress, deliveryFee' });
        }
        // Generate tracking number
        const trackingNumber = `BP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        const newDelivery = await database_1.default.insert(schema_1.deliveryRequests).values({
            customerId,
            merchantId,
            orderId,
            deliveryType: deliveryType,
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
            const availableDrivers = await database_1.default.select({
                userId: schema_1.users.id,
            })
                .from(schema_1.users)
                .leftJoin(schema_1.driverProfiles, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.driverProfiles.userId))
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.role, 'DRIVER'), (0, drizzle_orm_1.eq)(schema_1.driverProfiles.isAvailable, true), (0, drizzle_orm_1.eq)(schema_1.driverProfiles.isActive, true)))
                .limit(10); // Limit to 10 drivers for now
            // Send delivery request notifications to available drivers
            for (const driver of availableDrivers) {
                await (0, notifications_1.createNotification)({
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
        }
        catch (notificationError) {
            console.error('Failed to create delivery request notifications:', notificationError);
            // Don't fail the delivery creation if notification creation fails
        }
        res.status(201).json({
            message: 'Delivery request created successfully',
            delivery: newDelivery[0],
        });
    }
    catch (error) {
        console.error('Create delivery request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get available delivery requests for drivers
router.get('/available', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { deliveryType, maxDistance = 50 } = req.query;
        // Get driver profile to check capabilities
        const driverProfile = await database_1.default.select().from(schema_1.driverProfiles).where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, driverId));
        if (driverProfile.length === 0) {
            return res.status(400).json({ error: 'Driver profile not found. Please complete your profile first.' });
        }
        const driver = driverProfile[0];
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'PENDING')];
        // Filter by delivery type if driver has service type restrictions
        if (deliveryType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.deliveryType, deliveryType));
        }
        // Filter by premium driver requirement
        if (driver.driverTier === 'STANDARD') {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.requiresPremiumDriver, false));
        }
        const availableDeliveries = await database_1.default.select({
            id: schema_1.deliveryRequests.id,
            deliveryType: schema_1.deliveryRequests.deliveryType,
            cargoValue: schema_1.deliveryRequests.cargoValue,
            requiresPremiumDriver: schema_1.deliveryRequests.requiresPremiumDriver,
            pickupAddress: schema_1.deliveryRequests.pickupAddress,
            deliveryAddress: schema_1.deliveryRequests.deliveryAddress,
            estimatedDistance: schema_1.deliveryRequests.estimatedDistance,
            estimatedDuration: schema_1.deliveryRequests.estimatedDuration,
            deliveryFee: schema_1.deliveryRequests.deliveryFee,
            scheduledPickupTime: schema_1.deliveryRequests.scheduledPickupTime,
            specialInstructions: schema_1.deliveryRequests.specialInstructions,
            trackingNumber: schema_1.deliveryRequests.trackingNumber,
            createdAt: schema_1.deliveryRequests.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
            },
        })
            .from(schema_1.deliveryRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.customerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deliveryRequests.createdAt))
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
    }
    catch (error) {
        console.error('Get available deliveries error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Accept delivery request
router.post('/:id/accept', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const { id } = req.params;
        const driverId = req.user.userId;
        // Check if delivery is still available
        const delivery = await database_1.default.select().from(schema_1.deliveryRequests).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, id), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'PENDING')));
        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery request not found or already assigned' });
        }
        // Check driver qualifications
        const driverProfile = await database_1.default.select().from(schema_1.driverProfiles).where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, driverId));
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
        const updatedDelivery = await database_1.default.update(schema_1.deliveryRequests)
            .set({
            driverId,
            status: 'ASSIGNED',
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, id))
            .returning();
        // Notify customer and potentially merchant about driver assignment
        try {
            if (updatedDelivery[0].customerId) {
                await (0, notifications_1.createNotification)({
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
        }
        catch (notificationError) {
            console.error('Failed to create driver assigned notification:', notificationError);
        }
        res.json({
            message: 'Delivery request accepted successfully',
            delivery: updatedDelivery[0],
        });
    }
    catch (error) {
        console.error('Accept delivery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update delivery status
router.put('/:id/status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const { id: deliveryId } = req.params;
        const driverId = req.user.userId;
        const { status, actualPickupTime, actualDeliveryTime } = req.body;
        const validStatuses = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        // Check if delivery belongs to the driver
        const existingDelivery = await database_1.default.select().from(schema_1.deliveryRequests).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId)));
        if (existingDelivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found or you are not assigned to it' });
        }
        const updatedDelivery = await database_1.default.update(schema_1.deliveryRequests)
            .set({
            status: status,
            ...(status === 'PICKED_UP' && { actualPickupTime: new Date() }),
            ...(status === 'DELIVERED' && { actualDeliveryTime: new Date() }),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId)))
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
                await (0, notifications_1.createNotification)({
                    userId: updatedDelivery[0].customerId,
                    userRole: 'CONSUMER',
                    title: 'Delivery Update',
                    message: statusMessages[status] || `Your delivery status: ${status}`,
                    type: 'DELIVERY_UPDATE',
                    relatedId: deliveryId,
                    priority: status === 'DELIVERED' || status === 'CANCELLED' ? 'HIGH' : 'MEDIUM',
                    actionUrl: `/delivery/${deliveryId}/track`,
                });
            }
            // Notify merchant about delivery status
            if (updatedDelivery[0].merchantId && (status === 'DELIVERED' || status === 'CANCELLED')) {
                await (0, notifications_1.createNotification)({
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
        }
        catch (notificationError) {
            console.error('Failed to create delivery status notification:', notificationError);
            // Don't fail the delivery update if notification creation fails
        }
        res.json({
            status: 'Success',
            message: 'Delivery status updated successfully',
            data: updatedDelivery[0],
        });
    }
    catch (error) {
        console.error('Update delivery status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get driver's deliveries
router.get('/my-deliveries', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, status));
        }
        const driverDeliveries = await database_1.default.select({
            id: schema_1.deliveryRequests.id,
            deliveryType: schema_1.deliveryRequests.deliveryType,
            cargoValue: schema_1.deliveryRequests.cargoValue,
            pickupAddress: schema_1.deliveryRequests.pickupAddress,
            deliveryAddress: schema_1.deliveryRequests.deliveryAddress,
            estimatedDistance: schema_1.deliveryRequests.estimatedDistance,
            deliveryFee: schema_1.deliveryRequests.deliveryFee,
            status: schema_1.deliveryRequests.status,
            scheduledPickupTime: schema_1.deliveryRequests.scheduledPickupTime,
            actualPickupTime: schema_1.deliveryRequests.actualPickupTime,
            actualDeliveryTime: schema_1.deliveryRequests.actualDeliveryTime,
            trackingNumber: schema_1.deliveryRequests.trackingNumber,
            createdAt: schema_1.deliveryRequests.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
            },
        })
            .from(schema_1.deliveryRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.customerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deliveryRequests.createdAt))
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
    }
    catch (error) {
        console.error('Get driver deliveries error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Track delivery by tracking number (public)
router.get('/track/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const delivery = await database_1.default.select({
            id: schema_1.deliveryRequests.id,
            deliveryType: schema_1.deliveryRequests.deliveryType,
            pickupAddress: schema_1.deliveryRequests.pickupAddress,
            deliveryAddress: schema_1.deliveryRequests.deliveryAddress,
            status: schema_1.deliveryRequests.status,
            scheduledPickupTime: schema_1.deliveryRequests.scheduledPickupTime,
            actualPickupTime: schema_1.deliveryRequests.actualPickupTime,
            estimatedDeliveryTime: schema_1.deliveryRequests.estimatedDeliveryTime,
            actualDeliveryTime: schema_1.deliveryRequests.actualDeliveryTime,
            trackingNumber: schema_1.deliveryRequests.trackingNumber,
            createdAt: schema_1.deliveryRequests.createdAt,
            driver: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
            },
        })
            .from(schema_1.deliveryRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.trackingNumber, trackingNumber));
        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found' });
        }
        res.json(delivery[0]);
    }
    catch (error) {
        console.error('Track delivery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get delivery statistics for drivers
router.get('/stats', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const stats = await database_1.default.select({
            totalDeliveries: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            completedDeliveries: (0, drizzle_orm_1.sql) `count(*) filter (where status = 'DELIVERED')`.mapWith(Number),
            totalEarnings: (0, drizzle_orm_1.sql) `sum(${schema_1.deliveryRequests.deliveryFee})`,
        })
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId));
        const driverProfile = await database_1.default.select().from(schema_1.driverProfiles).where((0, drizzle_orm_1.eq)(schema_1.driverProfiles.userId, driverId));
        res.json({
            stats: stats[0],
            profile: driverProfile[0],
        });
    }
    catch (error) {
        console.error('Get delivery stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update delivery location (for drivers)
router.put('/:id/location', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const deliveryId = req.params.id;
        const driverId = req.user.userId;
        const { latitude, longitude, address } = req.body;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        // Verify this driver is assigned to the delivery
        const delivery = await database_1.default.select()
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId)));
        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found or not assigned to you' });
        }
        // Update delivery with current location (storing in special instructions for now)
        const updatedDelivery = await database_1.default.update(schema_1.deliveryRequests)
            .set({
            specialInstructions: JSON.stringify({ currentLatitude: latitude, currentLongitude: longitude, currentAddress: address }),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId))
            .returning();
        res.json({
            message: 'Location updated successfully',
            delivery: updatedDelivery[0],
        });
    }
    catch (error) {
        console.error('Update delivery location error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark delivery as picked up
router.put('/:id/pickup', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const deliveryId = req.params.id;
        const driverId = req.user.userId;
        const { pickupPhotoUrl, notes } = req.body;
        // Verify this driver is assigned to the delivery
        const delivery = await database_1.default.select()
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'ASSIGNED')));
        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found, not assigned to you, or not in correct status' });
        }
        // Update delivery status to picked up
        const updatedDelivery = await database_1.default.update(schema_1.deliveryRequests)
            .set({
            status: 'PICKED_UP',
            actualPickupTime: new Date(),
            proofOfDelivery: pickupPhotoUrl || null,
            specialInstructions: notes || null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId))
            .returning();
        res.json({
            message: 'Delivery marked as picked up',
            delivery: updatedDelivery[0],
        });
    }
    catch (error) {
        console.error('Mark delivery pickup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark delivery as delivered
router.put('/:id/deliver', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const deliveryId = req.params.id;
        const driverId = req.user.userId;
        const { deliveryPhotoUrl, recipientName, recipientSignature, notes } = req.body;
        // Verify this driver is assigned to the delivery
        const delivery = await database_1.default.select()
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'PICKED_UP')));
        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found, not assigned to you, or not picked up yet' });
        }
        // Update delivery status to delivered
        const updatedDelivery = await database_1.default.update(schema_1.deliveryRequests)
            .set({
            status: 'DELIVERED',
            actualDeliveryTime: new Date(),
            proofOfDelivery: deliveryPhotoUrl || null,
            specialInstructions: notes || null,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, deliveryId))
            .returning();
        // Update associated order status if linked
        if (delivery[0].orderId) {
            await database_1.default.update(schema_1.orders)
                .set({ status: 'delivered' })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, delivery[0].orderId));
        }
        res.json({
            message: 'Delivery completed successfully',
            delivery: updatedDelivery[0],
        });
    }
    catch (error) {
        console.error('Mark delivery completed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get delivery tracking information (public)
router.get('/track/:trackingNumber', async (req, res) => {
    try {
        const { trackingNumber } = req.params;
        const delivery = await database_1.default.select({
            delivery: schema_1.deliveryRequests,
            driver: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.deliveryRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.trackingNumber, trackingNumber));
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
            currentLocation: deliveryData.delivery.pickupLocation ? {
                latitude: deliveryData.delivery.pickupLocation.latitude || 0,
                longitude: deliveryData.delivery.pickupLocation.longitude || 0,
                address: deliveryData.delivery.pickupAddress,
            } : null,
            driver: deliveryData.driver ? {
                name: deliveryData.driver.fullName,
                phone: deliveryData.driver.phone,
                profilePicture: deliveryData.driver.profilePicture,
            } : null,
            timeline: {
                createdAt: deliveryData.delivery.createdAt,
                scheduledPickupTime: deliveryData.delivery.scheduledPickupTime,
                actualPickupTime: deliveryData.delivery.actualPickupTime,
                actualDeliveryTime: deliveryData.delivery.actualDeliveryTime,
            },
            proofOfDelivery: deliveryData.delivery.status === 'DELIVERED' ? {
                proofUrl: deliveryData.delivery.proofOfDelivery,
                specialInstructions: deliveryData.delivery.specialInstructions,
            } : null,
        });
    }
    catch (error) {
        console.error('Track delivery error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get driver earnings
router.get('/earnings', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { startDate, endDate, page = 1, limit = 10 } = req.query;
        let whereConditions = [
            (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId),
            (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'DELIVERED')
        ];
        if (startDate) {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.deliveryRequests.actualDeliveryTime} >= ${new Date(startDate)}`);
        }
        if (endDate) {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.deliveryRequests.actualDeliveryTime} <= ${new Date(endDate)}`);
        }
        // Get earnings summary
        const earningsSummary = await database_1.default.select({
            totalEarnings: (0, drizzle_orm_1.sql) `sum(${schema_1.deliveryRequests.deliveryFee})`,
            totalDeliveries: (0, drizzle_orm_1.sql) `count(*)`.mapWith(Number),
            averageEarningPerDelivery: (0, drizzle_orm_1.sql) `avg(${schema_1.deliveryRequests.deliveryFee})`,
        })
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.and)(...whereConditions));
        // Get detailed earnings
        const offset = (Number(page) - 1) * Number(limit);
        const detailedEarnings = await database_1.default.select({
            id: schema_1.deliveryRequests.id,
            deliveryFee: schema_1.deliveryRequests.deliveryFee,
            deliveryType: schema_1.deliveryRequests.deliveryType,
            trackingNumber: schema_1.deliveryRequests.trackingNumber,
            actualDeliveryTime: schema_1.deliveryRequests.actualDeliveryTime,
            customer: {
                fullName: schema_1.users.fullName,
            },
        })
            .from(schema_1.deliveryRequests)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.customerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.deliveryRequests.actualDeliveryTime))
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
    }
    catch (error) {
        console.error('Get driver earnings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Request payout
router.post('/request-payout', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { amount, bankAccount, accountNumber, bankCode } = req.body;
        if (!amount || !bankAccount || !accountNumber || !bankCode) {
            return res.status(400).json({
                error: 'Amount, bank account details are required'
            });
        }
        // Get driver's available balance
        const availableEarnings = await database_1.default.select({
            totalEarnings: (0, drizzle_orm_1.sql) `sum(${schema_1.deliveryRequests.deliveryFee})`,
        })
            .from(schema_1.deliveryRequests)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'DELIVERED')));
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
            await (0, notifications_1.createNotification)({
                userId: driverId,
                userRole: 'DRIVER',
                title: 'Payout Request Submitted',
                message: `Your payout request of ₦${amount} has been submitted and is pending confirmation.`,
                type: 'PAYOUT_CONFIRMATION',
                relatedId: payoutRequest.referenceId,
                priority: 'HIGH',
                actionUrl: '/earnings',
            });
        }
        catch (notificationError) {
            console.error('Failed to create payout confirmation notification:', notificationError);
        }
        res.json({
            status: 'Success',
            message: 'Payout request submitted successfully',
            data: payoutRequest,
        });
    }
    catch (error) {
        console.error('Request payout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get delivery route (basic implementation)
router.get('/:id/route', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const { id } = req.params;
        const driverId = req.user.userId;
        // Get delivery details
        const delivery = await database_1.default.select().from(schema_1.deliveryRequests).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, id), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, driverId)));
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
            currentLocation: deliveryData.pickupLocation ? {
                latitude: deliveryData.pickupLocation.latitude || 0,
                longitude: deliveryData.pickupLocation.longitude || 0,
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
    }
    catch (error) {
        console.error('Get delivery route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add delivery review/feedback (Consumer side)
router.post('/:id/review', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.userId;
        const { rating, feedback, driverRating } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        // Check if delivery belongs to the customer and is delivered
        const existingDelivery = await database_1.default.select().from(schema_1.deliveryRequests).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.id, id), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.customerId, customerId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'DELIVERED')));
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
                await (0, notifications_1.createNotification)({
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
        }
        catch (notificationError) {
            console.error('Failed to create delivery review notification:', notificationError);
        }
        res.json({
            status: 'Success',
            message: 'Delivery review submitted successfully',
            data: reviewData,
        });
    }
    catch (error) {
        console.error('Submit delivery review error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=delivery.js.map