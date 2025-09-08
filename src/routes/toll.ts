
import { Router } from 'express';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import crypto from 'crypto';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import db from '../config/database';
import { 
  users, 
  tollLocations, 
  tollPricing, 
  tollPayments,
  consumerNotifications 
} from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { createNotification } from './notifications';

const router = Router();

// Generate unique receipt number
const generateReceiptNumber = (): string => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TOLL-${timestamp}-${random}`;
};

// Generate QR code for toll payment
const generateQRCode = async (paymentData: any): Promise<string> => {
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

    const qrCodeDir = path.join(process.cwd(), 'uploads', 'qr-codes');
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }

    const filename = `toll-${paymentData.receiptNumber}.png`;
    const filepath = path.join(qrCodeDir, filename);
    
    await QRCode.toFile(filepath, qrData, {
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return `/api/upload/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Consumer/Driver: Make toll gate payment
router.post('/pay', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      locationId, 
      vehicleType, 
      vehiclePlate, 
      paymentMethod 
    } = req.body;

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
    const tollData = await db.select({
      location: {
        id: tollLocations.id,
        name: tollLocations.name,
        location: tollLocations.location,
        address: tollLocations.address,
        isActive: tollLocations.isActive
      },
      pricing: {
        price: tollPricing.price,
        currency: tollPricing.currency,
        isActive: tollPricing.isActive
      }
    })
      .from(tollLocations)
      .leftJoin(tollPricing, and(
        eq(tollPricing.locationId, tollLocations.id),
        eq(tollPricing.vehicleType, vehicleType),
        eq(tollPricing.isActive, true)
      ))
      .where(and(
        eq(tollLocations.id, locationId),
        eq(tollLocations.isActive, true)
      ));

    if (!tollData.length || !tollData[0].pricing.price) {
      return res.status(404).json({ 
        error: 'Toll location not found or pricing not available for this vehicle type' 
      });
    }

    const { location, pricing } = tollData[0];
    const paymentReference = `TOLL_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const receiptNumber = generateReceiptNumber();

    // Create toll payment record
    const [payment] = await db.insert(tollPayments).values({
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
    await db.update(tollPayments)
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
      .where(eq(tollPayments.id, payment.id));

    // Create notification for user
    await createNotification(userId, 'CONSUMER', {
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

  } catch (error) {
    console.error('Error processing toll payment:', error);
    res.status(500).json({ error: 'Failed to process toll payment' });
  }
});

// Consumer/Driver: Get toll payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = eq(tollPayments.userId, userId);
    
    if (startDate && endDate) {
      whereClause = and(
        whereClause,
        gte(tollPayments.createdAt, new Date(startDate as string)),
        lte(tollPayments.createdAt, new Date(endDate as string))
      );
    }

    const payments = await db.select({
      id: tollPayments.id,
      receiptNumber: tollPayments.receiptNumber,
      amount: tollPayments.amount,
      currency: tollPayments.currency,
      vehicleType: tollPayments.vehicleType,
      vehiclePlate: tollPayments.vehiclePlate,
      paymentMethod: tollPayments.paymentMethod,
      status: tollPayments.status,
      paymentDate: tollPayments.paymentDate,
      location: {
        name: tollLocations.name,
        address: tollLocations.address
      }
    })
      .from(tollPayments)
      .leftJoin(tollLocations, eq(tollPayments.locationId, tollLocations.id))
      .where(whereClause)
      .orderBy(desc(tollPayments.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const totalCount = await db.select({ count: sql`count(*)` })
      .from(tollPayments)
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

  } catch (error) {
    console.error('Error fetching toll payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Consumer/Driver: Get toll payment receipt
router.get('/:id/receipt', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const paymentId = req.params.id;

    const payment = await db.select({
      id: tollPayments.id,
      receiptNumber: tollPayments.receiptNumber,
      amount: tollPayments.amount,
      currency: tollPayments.currency,
      vehicleType: tollPayments.vehicleType,
      vehiclePlate: tollPayments.vehiclePlate,
      paymentMethod: tollPayments.paymentMethod,
      paymentReference: tollPayments.paymentReference,
      status: tollPayments.status,
      paymentDate: tollPayments.paymentDate,
      qrCodeImageUrl: tollPayments.qrCodeImageUrl,
      qrCodeData: tollPayments.qrCodeData,
      location: {
        name: tollLocations.name,
        address: tollLocations.address,
        location: tollLocations.location
      },
      user: {
        fullName: users.fullName,
        email: users.email
      }
    })
      .from(tollPayments)
      .leftJoin(tollLocations, eq(tollPayments.locationId, tollLocations.id))
      .leftJoin(users, eq(tollPayments.userId, users.id))
      .where(and(
        eq(tollPayments.id, paymentId),
        eq(tollPayments.userId, userId)
      ));

    if (!payment.length) {
      return res.status(404).json({ error: 'Payment receipt not found' });
    }

    res.json({
      status: 'Success',
      data: {
        receipt: payment[0]
      }
    });

  } catch (error) {
    console.error('Error fetching toll receipt:', error);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// Admin/Toll Operators: View all toll payments
router.get('/transactions', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      locationId, 
      vehicleType, 
      status, 
      startDate, 
      endDate 
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = sql`1=1`;
    
    if (locationId) {
      whereClause = and(whereClause, eq(tollPayments.locationId, Number(locationId)));
    }
    if (vehicleType) {
      whereClause = and(whereClause, eq(tollPayments.vehicleType, vehicleType as string));
    }
    if (status) {
      whereClause = and(whereClause, eq(tollPayments.status, status as string));
    }
    if (startDate && endDate) {
      whereClause = and(
        whereClause,
        gte(tollPayments.createdAt, new Date(startDate as string)),
        lte(tollPayments.createdAt, new Date(endDate as string))
      );
    }

    const transactions = await db.select({
      id: tollPayments.id,
      receiptNumber: tollPayments.receiptNumber,
      amount: tollPayments.amount,
      currency: tollPayments.currency,
      vehicleType: tollPayments.vehicleType,
      vehiclePlate: tollPayments.vehiclePlate,
      paymentMethod: tollPayments.paymentMethod,
      status: tollPayments.status,
      paymentDate: tollPayments.paymentDate,
      location: {
        name: tollLocations.name,
        address: tollLocations.address
      },
      user: {
        fullName: users.fullName,
        email: users.email
      }
    })
      .from(tollPayments)
      .leftJoin(tollLocations, eq(tollPayments.locationId, tollLocations.id))
      .leftJoin(users, eq(tollPayments.userId, users.id))
      .where(whereClause)
      .orderBy(desc(tollPayments.createdAt))
      .limit(Number(limit))
      .offset(offset);

    const totalCount = await db.select({ count: sql`count(*)` })
      .from(tollPayments)
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

  } catch (error) {
    console.error('Error fetching toll transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Admin/Toll Operators: Get toll usage statistics
router.get('/stats', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const { period = 'daily', locationId, startDate, endDate } = req.query;

    let whereClause = sql`1=1`;
    if (locationId) {
      whereClause = and(whereClause, eq(tollPayments.locationId, Number(locationId)));
    }
    if (startDate && endDate) {
      whereClause = and(
        whereClause,
        gte(tollPayments.createdAt, new Date(startDate as string)),
        lte(tollPayments.createdAt, new Date(endDate as string))
      );
    }

    // Get overall statistics
    const overallStats = await db.select({
      totalPayments: sql`count(*)`,
      totalRevenue: sql`sum(${tollPayments.amount})`,
      avgPayment: sql`avg(${tollPayments.amount})`,
    })
      .from(tollPayments)
      .where(and(whereClause, eq(tollPayments.status, 'SUCCESSFUL')));

    // Get statistics by vehicle type
    const vehicleStats = await db.select({
      vehicleType: tollPayments.vehicleType,
      count: sql`count(*)`,
      revenue: sql`sum(${tollPayments.amount})`
    })
      .from(tollPayments)
      .where(and(whereClause, eq(tollPayments.status, 'SUCCESSFUL')))
      .groupBy(tollPayments.vehicleType);

    // Get statistics by location
    const locationStats = await db.select({
      locationName: tollLocations.name,
      locationId: tollLocations.id,
      count: sql`count(*)`,
      revenue: sql`sum(${tollPayments.amount})`
    })
      .from(tollPayments)
      .leftJoin(tollLocations, eq(tollPayments.locationId, tollLocations.id))
      .where(and(whereClause, eq(tollPayments.status, 'SUCCESSFUL')))
      .groupBy(tollLocations.id, tollLocations.name);

    // Get time-based statistics
    let dateFormat;
    switch (period) {
      case 'weekly':
        dateFormat = sql`DATE_TRUNC('week', ${tollPayments.createdAt})`;
        break;
      case 'monthly':
        dateFormat = sql`DATE_TRUNC('month', ${tollPayments.createdAt})`;
        break;
      default:
        dateFormat = sql`DATE_TRUNC('day', ${tollPayments.createdAt})`;
    }

    const timeStats = await db.select({
      period: dateFormat,
      count: sql`count(*)`,
      revenue: sql`sum(${tollPayments.amount})`
    })
      .from(tollPayments)
      .where(and(whereClause, eq(tollPayments.status, 'SUCCESSFUL')))
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

  } catch (error) {
    console.error('Error fetching toll statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Admin: Add new toll location
router.post('/locations', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const { 
      name, 
      location, 
      address, 
      latitude, 
      longitude, 
      operatorId,
      operatingHours,
      pricing // Array of pricing for different vehicle types
    } = req.body;

    // Validate required fields
    if (!name || !location || !address || !latitude || !longitude || !pricing) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, location, address, latitude, longitude, pricing' 
      });
    }

    // Create toll location
    const [tollLocation] = await db.insert(tollLocations).values({
      name,
      location,
      address,
      latitude: String(latitude),
      longitude: String(longitude),
      operatorId,
      operatingHours
    }).returning();

    // Create pricing for different vehicle types
    const pricingData = pricing.map((price: any) => ({
      locationId: tollLocation.id,
      vehicleType: price.vehicleType,
      price: String(price.price),
      currency: price.currency || 'NGN'
    }));

    await db.insert(tollPricing).values(pricingData);

    res.status(201).json({
      status: 'Success',
      message: 'Toll location created successfully',
      data: {
        location: tollLocation,
        pricing: pricingData
      }
    });

  } catch (error) {
    console.error('Error creating toll location:', error);
    res.status(500).json({ error: 'Failed to create toll location' });
  }
});

// Admin: Update toll location and pricing
router.put('/locations/:id', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const locationId = req.params.id;
    const { 
      name, 
      location, 
      address, 
      latitude, 
      longitude, 
      operatorId,
      operatingHours,
      pricing,
      isActive 
    } = req.body;

    // Update toll location
    const updateData: any = {};
    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (address) updateData.address = address;
    if (latitude) updateData.latitude = String(latitude);
    if (longitude) updateData.longitude = String(longitude);
    if (operatorId !== undefined) updateData.operatorId = operatorId;
    if (operatingHours) updateData.operatingHours = operatingHours;
    if (isActive !== undefined) updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    const [updatedLocation] = await db.update(tollLocations)
      .set(updateData)
      .where(eq(tollLocations.id, Number(locationId)))
      .returning();

    if (!updatedLocation) {
      return res.status(404).json({ error: 'Toll location not found' });
    }

    // Update pricing if provided
    if (pricing && Array.isArray(pricing)) {
      // Deactivate existing pricing
      await db.update(tollPricing)
        .set({ isActive: false })
        .where(eq(tollPricing.locationId, Number(locationId)));

      // Insert new pricing
      const pricingData = pricing.map((price: any) => ({
        locationId: Number(locationId),
        vehicleType: price.vehicleType,
        price: String(price.price),
        currency: price.currency || 'NGN'
      }));

      await db.insert(tollPricing).values(pricingData);
    }

    res.json({
      status: 'Success',
      message: 'Toll location updated successfully',
      data: {
        location: updatedLocation
      }
    });

  } catch (error) {
    console.error('Error updating toll location:', error);
    res.status(500).json({ error: 'Failed to update toll location' });
  }
});

// Get all toll locations (public)
router.get('/locations', async (req, res) => {
  try {
    const { isActive = true } = req.query;

    const locations = await db.select({
      id: tollLocations.id,
      name: tollLocations.name,
      location: tollLocations.location,
      address: tollLocations.address,
      latitude: tollLocations.latitude,
      longitude: tollLocations.longitude,
      operatingHours: tollLocations.operatingHours,
      isActive: tollLocations.isActive,
      pricing: sql`
        COALESCE(
          json_agg(
            json_build_object(
              'vehicleType', ${tollPricing.vehicleType},
              'price', ${tollPricing.price},
              'currency', ${tollPricing.currency}
            )
          ) FILTER (WHERE ${tollPricing.isActive} = true),
          '[]'::json
        )
      `
    })
      .from(tollLocations)
      .leftJoin(tollPricing, and(
        eq(tollPricing.locationId, tollLocations.id),
        eq(tollPricing.isActive, true)
      ))
      .where(eq(tollLocations.isActive, isActive === 'true'))
      .groupBy(tollLocations.id)
      .orderBy(tollLocations.name);

    res.json({
      status: 'Success',
      data: { locations }
    });

  } catch (error) {
    console.error('Error fetching toll locations:', error);
    res.status(500).json({ error: 'Failed to fetch toll locations' });
  }
});

export default router;
