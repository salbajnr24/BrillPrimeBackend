"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = __importDefault(require("crypto"));
const qrcode_1 = __importDefault(require("qrcode"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const notifications_1 = require("./notifications");
const router = (0, express_1.Router)();
// Generate unique receipt number
const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TOLL-${timestamp}-${random}`;
};
// Generate QR code for toll payment
const generateQRCode = async (paymentData) => {
    try {
        const qrData = JSON.stringify({
            type: 'TOLL_PAYMENT',
            paymentId: paymentData.id,
            receiptNumber: paymentData.receiptNumber,
            location: paymentData.locationName,
            amount: paymentData.amount,
            vehiclePlate: paymentData.vehiclePlate,
            timestamp: paymentData.createdAt
        });
        const qrCodeDir = path_1.default.join(process.cwd(), 'uploads', 'qr-codes');
        if (!fs_1.default.existsSync(qrCodeDir)) {
            fs_1.default.mkdirSync(qrCodeDir, { recursive: true });
        }
        const filename = `toll-${paymentData.receiptNumber}.png`;
        const filepath = path_1.default.join(qrCodeDir, filename);
        await qrcode_1.default.toFile(filepath, qrData, {
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
        return `/api/upload/qr-codes/${filename}`;
    }
    catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
};
// Consumer/Driver: Make toll gate payment
router.post('/pay', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { locationId, vehicleType, vehiclePlate, paymentMethod } = req.body;
        // Validate required fields
        if (!locationId || !vehicleType || !vehiclePlate || !paymentMethod) {
            return res.status(400).json({
                error: 'Missing required fields: locationId, vehicleType, vehiclePlate, paymentMethod'
            });
        }
        // Validate vehicle type
        const validVehicleTypes = ['MOTORCYCLE', 'CAR', 'BUS', 'TRUCK', 'TRAILER'];
        if (!validVehicleTypes.includes(vehicleType)) {
            return res.status(400).json({
                error: 'Invalid vehicle type. Must be one of: MOTORCYCLE, CAR, BUS, TRUCK, TRAILER'
            });
        }
        // Get toll location and pricing
        const tollData = await database_1.default.select({
            location: {
                id: schema_1.tollLocations.id,
                name: schema_1.tollLocations.name,
                location: schema_1.tollLocations.location,
                address: schema_1.tollLocations.address,
                isActive: schema_1.tollLocations.isActive
            },
            pricing: {
                price: schema_1.tollPricing.price,
                currency: schema_1.tollPricing.currency,
                isActive: schema_1.tollPricing.isActive
            }
        })
            .from(schema_1.tollLocations)
            .leftJoin(schema_1.tollPricing, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tollPricing.locationId, schema_1.tollLocations.id), (0, drizzle_orm_1.eq)(schema_1.tollPricing.vehicleType, vehicleType), (0, drizzle_orm_1.eq)(schema_1.tollPricing.isActive, true)))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tollLocations.id, locationId), (0, drizzle_orm_1.eq)(schema_1.tollLocations.isActive, true)));
        if (!tollData.length || !tollData[0].pricing.price) {
            return res.status(404).json({
                error: 'Toll location not found or pricing not available for this vehicle type'
            });
        }
        const { location, pricing } = tollData[0];
        const paymentReference = `TOLL_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const receiptNumber = generateReceiptNumber();
        // Create toll payment record
        const [payment] = await database_1.default.insert(schema_1.tollPayments).values({
            userId,
            locationId,
            vehicleType,
            vehiclePlate: vehiclePlate.toUpperCase(),
            amount: pricing.price,
            currency: pricing.currency,
            paymentMethod,
            paymentReference,
            receiptNumber,
            status: 'SUCCESSFUL', // In real implementation, this would be 'PENDING' until payment gateway confirms
            qrCodeData: '', // Will be updated after QR code generation
        }).returning();
        // Generate QR code for the payment
        const qrCodeUrl = await generateQRCode({
            id: payment.id,
            receiptNumber: payment.receiptNumber,
            locationName: location.name,
            amount: payment.amount,
            vehiclePlate: payment.vehiclePlate,
            createdAt: payment.createdAt
        });
        // Update payment with QR code URL
        await database_1.default.update(schema_1.tollPayments)
            .set({
            qrCodeImageUrl: qrCodeUrl,
            qrCodeData: JSON.stringify({
                type: 'TOLL_PAYMENT',
                paymentId: payment.id,
                receiptNumber: payment.receiptNumber,
                location: location.name,
                amount: payment.amount,
                vehiclePlate: payment.vehiclePlate,
                timestamp: payment.createdAt
            })
        })
            .where((0, drizzle_orm_1.eq)(schema_1.tollPayments.id, payment.id));
        // Create notification for user
        await (0, notifications_1.createNotification)(userId, 'CONSUMER', {
            title: 'Toll Payment Successful',
            message: `Your toll payment of ₦${pricing.price} at ${location.name} has been processed successfully.`,
            type: 'PAYMENT',
            relatedId: payment.id,
            actionUrl: `/toll/${payment.id}/receipt`
        });
        res.status(201).json({
            status: 'Success',
            message: 'Toll payment processed successfully',
            data: {
                paymentId: payment.id,
                receiptNumber: payment.receiptNumber,
                amount: payment.amount,
                currency: payment.currency,
                location: {
                    name: location.name,
                    address: location.address
                },
                vehiclePlate: payment.vehiclePlate,
                qrCodeUrl,
                paymentDate: payment.paymentDate
            }
        });
    }
    catch (error) {
        console.error('Error processing toll payment:', error);
        res.status(500).json({ error: 'Failed to process toll payment' });
    }
});
// Consumer/Driver: Get toll payment history
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { page = 1, limit = 20, startDate, endDate } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = (0, drizzle_orm_1.eq)(schema_1.tollPayments.userId, userId);
        if (startDate && endDate) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.gte)(schema_1.tollPayments.createdAt, new Date(startDate)), (0, drizzle_orm_1.lte)(schema_1.tollPayments.createdAt, new Date(endDate)));
        }
        const payments = await database_1.default.select({
            id: schema_1.tollPayments.id,
            receiptNumber: schema_1.tollPayments.receiptNumber,
            amount: schema_1.tollPayments.amount,
            currency: schema_1.tollPayments.currency,
            vehicleType: schema_1.tollPayments.vehicleType,
            vehiclePlate: schema_1.tollPayments.vehiclePlate,
            paymentMethod: schema_1.tollPayments.paymentMethod,
            status: schema_1.tollPayments.status,
            paymentDate: schema_1.tollPayments.paymentDate,
            location: {
                name: schema_1.tollLocations.name,
                address: schema_1.tollLocations.address
            }
        })
            .from(schema_1.tollPayments)
            .leftJoin(schema_1.tollLocations, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, schema_1.tollLocations.id))
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.tollPayments.createdAt))
            .limit(Number(limit))
            .offset(offset);
        const totalCount = await database_1.default.select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.tollPayments)
            .where(whereClause);
        res.json({
            status: 'Success',
            data: {
                payments,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: Number(totalCount[0].count),
                    pages: Math.ceil(Number(totalCount[0].count) / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching toll payment history:', error);
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});
// Consumer/Driver: Get toll payment receipt
router.get('/:id/receipt', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const paymentId = req.params.id;
        const payment = await database_1.default.select({
            id: schema_1.tollPayments.id,
            receiptNumber: schema_1.tollPayments.receiptNumber,
            amount: schema_1.tollPayments.amount,
            currency: schema_1.tollPayments.currency,
            vehicleType: schema_1.tollPayments.vehicleType,
            vehiclePlate: schema_1.tollPayments.vehiclePlate,
            paymentMethod: schema_1.tollPayments.paymentMethod,
            paymentReference: schema_1.tollPayments.paymentReference,
            status: schema_1.tollPayments.status,
            paymentDate: schema_1.tollPayments.paymentDate,
            qrCodeImageUrl: schema_1.tollPayments.qrCodeImageUrl,
            qrCodeData: schema_1.tollPayments.qrCodeData,
            location: {
                name: schema_1.tollLocations.name,
                address: schema_1.tollLocations.address,
                location: schema_1.tollLocations.location
            },
            user: {
                fullName: schema_1.users.fullName,
                email: schema_1.users.email
            }
        })
            .from(schema_1.tollPayments)
            .leftJoin(schema_1.tollLocations, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, schema_1.tollLocations.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.tollPayments.userId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tollPayments.id, paymentId), (0, drizzle_orm_1.eq)(schema_1.tollPayments.userId, userId)));
        if (!payment.length) {
            return res.status(404).json({ error: 'Payment receipt not found' });
        }
        res.json({
            status: 'Success',
            data: {
                receipt: payment[0]
            }
        });
    }
    catch (error) {
        console.error('Error fetching toll receipt:', error);
        res.status(500).json({ error: 'Failed to fetch receipt' });
    }
});
// Admin/Toll Operators: View all toll payments
router.get('/transactions', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { page = 1, limit = 20, locationId, vehicleType, status, startDate, endDate } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = (0, drizzle_orm_1.sql) `1=1`;
        if (locationId) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, Number(locationId)));
        }
        if (vehicleType) {
            const validVehicleTypes = ['MOTORCYCLE', 'CAR', 'TRUCK', 'BUS', 'TRAILER'];
            if (validVehicleTypes.includes(vehicleType)) {
                whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.vehicleType, vehicleType));
            }
        }
        if (status) {
            const validStatuses = ['PENDING', 'CANCELLED', 'SUCCESSFUL', 'FAILED'];
            if (validStatuses.includes(status)) {
                whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.status, status));
            }
        }
        if (startDate && endDate) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.gte)(schema_1.tollPayments.createdAt, new Date(startDate)), (0, drizzle_orm_1.lte)(schema_1.tollPayments.createdAt, new Date(endDate)));
        }
        const transactions = await database_1.default.select({
            id: schema_1.tollPayments.id,
            receiptNumber: schema_1.tollPayments.receiptNumber,
            amount: schema_1.tollPayments.amount,
            currency: schema_1.tollPayments.currency,
            vehicleType: schema_1.tollPayments.vehicleType,
            vehiclePlate: schema_1.tollPayments.vehiclePlate,
            paymentMethod: schema_1.tollPayments.paymentMethod,
            status: schema_1.tollPayments.status,
            paymentDate: schema_1.tollPayments.paymentDate,
            location: {
                name: schema_1.tollLocations.name,
                address: schema_1.tollLocations.address
            },
            user: {
                fullName: schema_1.users.fullName,
                email: schema_1.users.email
            }
        })
            .from(schema_1.tollPayments)
            .leftJoin(schema_1.tollLocations, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, schema_1.tollLocations.id))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.tollPayments.userId, schema_1.users.id))
            .where(whereClause)
            .orderBy((0, drizzle_orm_1.desc)(schema_1.tollPayments.createdAt))
            .limit(Number(limit))
            .offset(offset);
        const totalCount = await database_1.default.select({ count: (0, drizzle_orm_1.sql) `count(*)` })
            .from(schema_1.tollPayments)
            .where(whereClause);
        res.json({
            status: 'Success',
            data: {
                transactions,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: Number(totalCount[0].count),
                    pages: Math.ceil(Number(totalCount[0].count) / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching toll transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});
// Admin/Toll Operators: Get toll usage statistics
router.get('/stats', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { period = 'daily', locationId, startDate, endDate } = req.query;
        let whereClause = (0, drizzle_orm_1.sql) `1=1`;
        if (locationId) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, Number(locationId)));
        }
        if (startDate && endDate) {
            whereClause = (0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.gte)(schema_1.tollPayments.createdAt, new Date(startDate)), (0, drizzle_orm_1.lte)(schema_1.tollPayments.createdAt, new Date(endDate)));
        }
        // Get overall statistics
        const overallStats = await database_1.default.select({
            totalPayments: (0, drizzle_orm_1.sql) `count(*)`,
            totalRevenue: (0, drizzle_orm_1.sql) `sum(${schema_1.tollPayments.amount})`,
            avgPayment: (0, drizzle_orm_1.sql) `avg(${schema_1.tollPayments.amount})`,
        })
            .from(schema_1.tollPayments)
            .where((0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.status, 'SUCCESSFUL')));
        // Get statistics by vehicle type
        const vehicleStats = await database_1.default.select({
            vehicleType: schema_1.tollPayments.vehicleType,
            count: (0, drizzle_orm_1.sql) `count(*)`,
            revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.tollPayments.amount})`
        })
            .from(schema_1.tollPayments)
            .where((0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.status, 'SUCCESSFUL')))
            .groupBy(schema_1.tollPayments.vehicleType);
        // Get statistics by location
        const locationStats = await database_1.default.select({
            locationName: schema_1.tollLocations.name,
            locationId: schema_1.tollLocations.id,
            count: (0, drizzle_orm_1.sql) `count(*)`,
            revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.tollPayments.amount})`
        })
            .from(schema_1.tollPayments)
            .leftJoin(schema_1.tollLocations, (0, drizzle_orm_1.eq)(schema_1.tollPayments.locationId, schema_1.tollLocations.id))
            .where((0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.status, 'SUCCESSFUL')))
            .groupBy(schema_1.tollLocations.id, schema_1.tollLocations.name);
        // Get time-based statistics
        let dateFormat;
        switch (period) {
            case 'weekly':
                dateFormat = (0, drizzle_orm_1.sql) `DATE_TRUNC('week', ${schema_1.tollPayments.createdAt})`;
                break;
            case 'monthly':
                dateFormat = (0, drizzle_orm_1.sql) `DATE_TRUNC('month', ${schema_1.tollPayments.createdAt})`;
                break;
            default:
                dateFormat = (0, drizzle_orm_1.sql) `DATE_TRUNC('day', ${schema_1.tollPayments.createdAt})`;
        }
        const timeStats = await database_1.default.select({
            period: dateFormat,
            count: (0, drizzle_orm_1.sql) `count(*)`,
            revenue: (0, drizzle_orm_1.sql) `sum(${schema_1.tollPayments.amount})`
        })
            .from(schema_1.tollPayments)
            .where((0, drizzle_orm_1.and)(whereClause, (0, drizzle_orm_1.eq)(schema_1.tollPayments.status, 'SUCCESSFUL')))
            .groupBy(dateFormat)
            .orderBy(dateFormat);
        res.json({
            status: 'Success',
            data: {
                overall: overallStats[0],
                byVehicleType: vehicleStats,
                byLocation: locationStats,
                byTime: timeStats
            }
        });
    }
    catch (error) {
        console.error('Error fetching toll statistics:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// Admin: Add new toll location
router.post('/locations', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { name, location, address, latitude, longitude, operatorId, operatingHours, pricing // Array of pricing for different vehicle types
         } = req.body;
        // Validate required fields
        if (!name || !location || !address || !latitude || !longitude || !pricing) {
            return res.status(400).json({
                error: 'Missing required fields: name, location, address, latitude, longitude, pricing'
            });
        }
        // Create toll location
        const [tollLocation] = await database_1.default.insert(schema_1.tollLocations).values({
            name,
            location,
            address,
            latitude: String(latitude),
            longitude: String(longitude),
            operatorId,
            operatingHours
        }).returning();
        // Create pricing for different vehicle types
        const pricingData = pricing.map((price) => ({
            locationId: tollLocation.id,
            vehicleType: price.vehicleType,
            price: String(price.price),
            currency: price.currency || 'NGN'
        }));
        await database_1.default.insert(schema_1.tollPricing).values(pricingData);
        res.status(201).json({
            status: 'Success',
            message: 'Toll location created successfully',
            data: {
                location: tollLocation,
                pricing: pricingData
            }
        });
    }
    catch (error) {
        console.error('Error creating toll location:', error);
        res.status(500).json({ error: 'Failed to create toll location' });
    }
});
// Admin: Update toll location and pricing
router.put('/locations/:id', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const locationId = req.params.id;
        const { name, location, address, latitude, longitude, operatorId, operatingHours, pricing, isActive } = req.body;
        // Update toll location
        const updateData = {};
        if (name)
            updateData.name = name;
        if (location)
            updateData.location = location;
        if (address)
            updateData.address = address;
        if (latitude)
            updateData.latitude = String(latitude);
        if (longitude)
            updateData.longitude = String(longitude);
        if (operatorId !== undefined)
            updateData.operatorId = operatorId;
        if (operatingHours)
            updateData.operatingHours = operatingHours;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        updateData.updatedAt = new Date();
        const [updatedLocation] = await database_1.default.update(schema_1.tollLocations)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.tollLocations.id, Number(locationId)))
            .returning();
        if (!updatedLocation) {
            return res.status(404).json({ error: 'Toll location not found' });
        }
        // Update pricing if provided
        if (pricing && Array.isArray(pricing)) {
            // Deactivate existing pricing
            await database_1.default.update(schema_1.tollPricing)
                .set({ isActive: false })
                .where((0, drizzle_orm_1.eq)(schema_1.tollPricing.locationId, Number(locationId)));
            // Insert new pricing
            const pricingData = pricing.map((price) => ({
                locationId: Number(locationId),
                vehicleType: price.vehicleType,
                price: String(price.price),
                currency: price.currency || 'NGN'
            }));
            await database_1.default.insert(schema_1.tollPricing).values(pricingData);
        }
        res.json({
            status: 'Success',
            message: 'Toll location updated successfully',
            data: {
                location: updatedLocation
            }
        });
    }
    catch (error) {
        console.error('Error updating toll location:', error);
        res.status(500).json({ error: 'Failed to update toll location' });
    }
});
// Get all toll locations (public)
router.get('/locations', async (req, res) => {
    try {
        const { isActive = true } = req.query;
        const locations = await database_1.default.select({
            id: schema_1.tollLocations.id,
            name: schema_1.tollLocations.name,
            location: schema_1.tollLocations.location,
            address: schema_1.tollLocations.address,
            latitude: schema_1.tollLocations.latitude,
            longitude: schema_1.tollLocations.longitude,
            operatingHours: schema_1.tollLocations.operatingHours,
            isActive: schema_1.tollLocations.isActive,
            pricing: (0, drizzle_orm_1.sql) `
        COALESCE(
          json_agg(
            json_build_object(
              'vehicleType', ${schema_1.tollPricing.vehicleType},
              'price', ${schema_1.tollPricing.price},
              'currency', ${schema_1.tollPricing.currency}
            )
          ) FILTER (WHERE ${schema_1.tollPricing.isActive} = true),
          '[]'::json
        )
      `
        })
            .from(schema_1.tollLocations)
            .leftJoin(schema_1.tollPricing, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.tollPricing.locationId, schema_1.tollLocations.id), (0, drizzle_orm_1.eq)(schema_1.tollPricing.isActive, true)))
            .where((0, drizzle_orm_1.eq)(schema_1.tollLocations.isActive, isActive === 'true'))
            .groupBy(schema_1.tollLocations.id)
            .orderBy(schema_1.tollLocations.name);
        res.json({
            status: 'Success',
            data: { locations }
        });
    }
    catch (error) {
        console.error('Error fetching toll locations:', error);
        res.status(500).json({ error: 'Failed to fetch toll locations' });
    }
});
exports.default = router;
//# sourceMappingURL=toll.js.map