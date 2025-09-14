
import { Router } from 'express';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import db from '../config/database';
import { 
  fuelInventory, 
  fuelOrders, 
  users, 
  deliveryRequests,
  merchantProfiles,
  driverProfiles
} from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import { createNotification } from './notifications';

const router = Router();

// ===============================
// CONSUMER ENDPOINTS
// ===============================

// Place a new fuel order
router.post('/order', authenticateToken, async (req, res) => {
  try {
    const customerId = (req as any).user.userId;
    const {
      inventoryId,
      orderType,
      quantity,
      deliveryAddress,
      deliveryDate,
      specialInstructions
    } = req.body;

    if (!inventoryId || !orderType || !quantity || !deliveryAddress) {
      return res.status(400).json({ 
        error: 'Inventory ID, order type, quantity, and delivery address are required' 
      });
    }

    // Get fuel inventory details
    const inventory = await db.select({
      id: fuelInventory.id,
      merchantId: fuelInventory.merchantId,
      fuelType: fuelInventory.fuelType,
      quantity: fuelInventory.quantity,
      unit: fuelInventory.unit,
      pricePerUnit: fuelInventory.pricePerUnit,
      minimumOrderQuantity: fuelInventory.minimumOrderQuantity,
      maximumOrderQuantity: fuelInventory.maximumOrderQuantity,
      isAvailable: fuelInventory.isAvailable,
      merchant: {
        fullName: users.fullName,
        location: merchantProfiles.businessAddress,
      },
    })
      .from(fuelInventory)
      .leftJoin(users, eq(fuelInventory.merchantId, users.id))
      .leftJoin(merchantProfiles, eq(fuelInventory.merchantId, merchantProfiles.userId))
      .where(eq(fuelInventory.id, inventoryId));

    if (inventory.length === 0) {
      return res.status(404).json({ error: 'Fuel inventory not found' });
    }

    const inventoryData = inventory[0];

    if (!inventoryData.isAvailable) {
      return res.status(400).json({ error: 'This fuel type is currently not available' });
    }

    // Validate quantity
    const orderQuantity = parseFloat(quantity);
    const availableQuantity = parseFloat(inventoryData.quantity);
    const minQuantity = parseFloat(inventoryData.minimumOrderQuantity || '1');
    const maxQuantity = inventoryData.maximumOrderQuantity ? parseFloat(inventoryData.maximumOrderQuantity) : null;

    if (orderQuantity < minQuantity) {
      return res.status(400).json({ 
        error: `Minimum order quantity is ${minQuantity} ${inventoryData.unit}` 
      });
    }

    if (maxQuantity && orderQuantity > maxQuantity) {
      return res.status(400).json({ 
        error: `Maximum order quantity is ${maxQuantity} ${inventoryData.unit}` 
      });
    }

    if (orderQuantity > availableQuantity) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${availableQuantity} ${inventoryData.unit}` 
      });
    }

    // Calculate total price
    const pricePerUnit = parseFloat(inventoryData.pricePerUnit);
    const totalPrice = orderQuantity * pricePerUnit;

    // Generate order number
    const orderNumber = `FO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create fuel order
    const newOrder = await db.insert(fuelOrders).values({
      customerId,
      merchantId: inventoryData.merchantId,
      inventoryId,
      orderType: orderType as any,
      fuelType: inventoryData.fuelType as any,
      quantity: quantity.toString(),
      unit: inventoryData.unit as any,
      pricePerUnit: inventoryData.pricePerUnit,
      totalPrice: totalPrice.toString(),
      deliveryAddress,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      specialInstructions,
      orderNumber,
    }).returning();

    // Update inventory quantity
    const newInventoryQuantity = availableQuantity - orderQuantity;
    await db.update(fuelInventory)
      .set({ 
        quantity: newInventoryQuantity.toString(),
        updatedAt: new Date()
      })
      .where(eq(fuelInventory.id, inventoryId));

    // Notify merchant about new fuel order
    try {
      await createNotification({
        userId: inventoryData.merchantId,
        userRole: 'MERCHANT',
        title: 'New Fuel Order',
        message: `New ${orderType.toLowerCase()} fuel order: ${quantity} ${inventoryData.unit} of ${inventoryData.fuelType}`,
        type: 'FUEL_ORDER',
        relatedId: newOrder[0].id.toString(),
        priority: orderType === 'BULK' ? 'HIGH' : 'MEDIUM',
        actionUrl: `/fuel/merchant/orders/${newOrder[0].id}`,
      });
    } catch (notificationError) {
      console.error('Failed to create fuel order notification:', notificationError);
    }

    res.status(201).json({
      status: 'Success',
      message: 'Fuel order placed successfully',
      data: {
        order: newOrder[0],
        merchant: inventoryData.merchant,
      },
    });
  } catch (error) {
    console.error('Place fuel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's fuel orders
router.get('/orders', authenticateToken, async (req, res) => {
  try {
    const customerId = (req as any).user.userId;
    const { page = 1, limit = 10, status, orderType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(fuelOrders.customerId, customerId)];
    
    if (status) {
      whereConditions.push(eq(fuelOrders.status, status as any));
    }
    
    if (orderType) {
      whereConditions.push(eq(fuelOrders.orderType, orderType as any));
    }

    const userFuelOrders = await db.select({
      id: fuelOrders.id,
      orderNumber: fuelOrders.orderNumber,
      orderType: fuelOrders.orderType,
      fuelType: fuelOrders.fuelType,
      quantity: fuelOrders.quantity,
      unit: fuelOrders.unit,
      pricePerUnit: fuelOrders.pricePerUnit,
      totalPrice: fuelOrders.totalPrice,
      deliveryAddress: fuelOrders.deliveryAddress,
      deliveryDate: fuelOrders.deliveryDate,
      status: fuelOrders.status,
      paymentStatus: fuelOrders.paymentStatus,
      estimatedDeliveryTime: fuelOrders.estimatedDeliveryTime,
      actualDeliveryTime: fuelOrders.actualDeliveryTime,
      createdAt: fuelOrders.createdAt,
      merchant: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        businessName: merchantProfiles.businessName,
        businessAddress: merchantProfiles.businessAddress,
      },
    })
      .from(fuelOrders)
      .leftJoin(users, eq(fuelOrders.merchantId, users.id))
      .leftJoin(merchantProfiles, eq(fuelOrders.merchantId, merchantProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(desc(fuelOrders.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Fuel orders fetched successfully',
      data: {
        orders: userFuelOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: userFuelOrders.length,
        },
      },
    });
  } catch (error) {
    console.error('Get fuel orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get details of a specific fuel order
router.get('/orders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = (req as any).user.userId;

    const fuelOrder = await db.select({
      id: fuelOrders.id,
      orderNumber: fuelOrders.orderNumber,
      orderType: fuelOrders.orderType,
      fuelType: fuelOrders.fuelType,
      quantity: fuelOrders.quantity,
      unit: fuelOrders.unit,
      pricePerUnit: fuelOrders.pricePerUnit,
      totalPrice: fuelOrders.totalPrice,
      deliveryAddress: fuelOrders.deliveryAddress,
      deliveryDate: fuelOrders.deliveryDate,
      status: fuelOrders.status,
      paymentStatus: fuelOrders.paymentStatus,
      specialInstructions: fuelOrders.specialInstructions,
      estimatedDeliveryTime: fuelOrders.estimatedDeliveryTime,
      actualDeliveryTime: fuelOrders.actualDeliveryTime,
      createdAt: fuelOrders.createdAt,
      updatedAt: fuelOrders.updatedAt,
      merchant: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
        businessName: merchantProfiles.businessName,
        businessAddress: merchantProfiles.businessAddress,
      },
      driver: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        profilePicture: users.profilePicture,
      },
    })
      .from(fuelOrders)
      .leftJoin(users, eq(fuelOrders.merchantId, users.id))
      .leftJoin(merchantProfiles, eq(fuelOrders.merchantId, merchantProfiles.userId))
      .leftJoin(users, eq(fuelOrders.driverId, users.id))
      .where(and(
        eq(fuelOrders.id, Number(id)),
        eq(fuelOrders.customerId, customerId)
      ));

    if (fuelOrder.length === 0) {
      return res.status(404).json({ error: 'Fuel order not found' });
    }

    res.json({
      status: 'Success',
      message: 'Fuel order details fetched successfully',
      data: fuelOrder[0],
    });
  } catch (error) {
    console.error('Get fuel order details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel fuel order
router.put('/orders/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = (req as any).user.userId;
    const { reason } = req.body;

    // Check if order belongs to the customer and can be cancelled
    const existingOrder = await db.select().from(fuelOrders).where(and(
      eq(fuelOrders.id, Number(id)),
      eq(fuelOrders.customerId, customerId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ error: 'Fuel order not found' });
    }

    const order = existingOrder[0];

    // Only allow cancellation for pending, confirmed orders
    if (!order.status || !['PENDING', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({ 
        error: 'Order cannot be cancelled at this stage' 
      });
    }

    // Update order status
    const updatedOrder = await db.update(fuelOrders)
      .set({ 
        status: 'CANCELLED',
        updatedAt: new Date()
      })
      .where(eq(fuelOrders.id, Number(id)))
      .returning();

    // Restore inventory quantity
    const orderQuantity = parseFloat(order.quantity);
    const currentInventory = await db.select().from(fuelInventory).where(eq(fuelInventory.id, order.inventoryId));
    
    if (currentInventory.length > 0) {
      const newQuantity = parseFloat(currentInventory[0].quantity) + orderQuantity;
      await db.update(fuelInventory)
        .set({ 
          quantity: newQuantity.toString(),
          updatedAt: new Date()
        })
        .where(eq(fuelInventory.id, order.inventoryId));
    }

    // Notify merchant about cancellation
    try {
      await createNotification({
        userId: order.merchantId,
        userRole: 'MERCHANT',
        title: 'Fuel Order Cancelled',
        message: `Order ${order.orderNumber} has been cancelled by the customer`,
        type: 'FUEL_ORDER',
        relatedId: id,
        priority: 'MEDIUM',
        actionUrl: `/fuel/merchant/orders/${id}`,
      });
    } catch (notificationError) {
      console.error('Failed to create cancellation notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Fuel order cancelled successfully',
      data: updatedOrder[0],
    });
  } catch (error) {
    console.error('Cancel fuel order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===============================
// MERCHANT/DISTRIBUTOR ENDPOINTS
// ===============================

// Get incoming fuel orders for merchants
router.get('/merchant/orders', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { page = 1, limit = 10, status, orderType } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(fuelOrders.merchantId, merchantId)];
    
    if (status) {
      whereConditions.push(eq(fuelOrders.status, status as any));
    }
    
    if (orderType) {
      whereConditions.push(eq(fuelOrders.orderType, orderType as any));
    }

    const merchantOrders = await db.select({
      id: fuelOrders.id,
      orderNumber: fuelOrders.orderNumber,
      orderType: fuelOrders.orderType,
      fuelType: fuelOrders.fuelType,
      quantity: fuelOrders.quantity,
      unit: fuelOrders.unit,
      pricePerUnit: fuelOrders.pricePerUnit,
      totalPrice: fuelOrders.totalPrice,
      deliveryAddress: fuelOrders.deliveryAddress,
      deliveryDate: fuelOrders.deliveryDate,
      status: fuelOrders.status,
      paymentStatus: fuelOrders.paymentStatus,
      specialInstructions: fuelOrders.specialInstructions,
      estimatedDeliveryTime: fuelOrders.estimatedDeliveryTime,
      createdAt: fuelOrders.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
      },
    })
      .from(fuelOrders)
      .leftJoin(users, eq(fuelOrders.customerId, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(fuelOrders.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Merchant fuel orders fetched successfully',
      data: {
        orders: merchantOrders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: merchantOrders.length,
        },
      },
    });
  } catch (error) {
    console.error('Get merchant fuel orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update fuel order status
router.put('/orders/:id/status', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const { id } = req.params;
    const merchantId = (req as any).user.userId;
    const { status, estimatedDeliveryTime } = req.body;

    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if order belongs to the merchant
    const existingOrder = await db.select().from(fuelOrders).where(and(
      eq(fuelOrders.id, Number(id)),
      eq(fuelOrders.merchantId, merchantId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ 
        error: 'Fuel order not found or you do not have permission to update it' 
      });
    }

    const order = existingOrder[0];

    // Update order status
    const updateData: any = { 
      status: status as any,
      updatedAt: new Date()
    };

    if (estimatedDeliveryTime) {
      updateData.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
    }

    if (status === 'DELIVERED') {
      updateData.actualDeliveryTime = new Date();
    }

    const updatedOrder = await db.update(fuelOrders)
      .set(updateData)
      .where(eq(fuelOrders.id, Number(id)))
      .returning();

    // Create notification for customer about status change
    const statusMessages = {
      CONFIRMED: 'Your fuel order has been confirmed',
      PROCESSING: 'Your fuel order is being processed',
      DISPATCHED: 'Your fuel order has been dispatched for delivery',
      DELIVERED: 'Your fuel order has been delivered successfully',
      CANCELLED: 'Your fuel order has been cancelled'
    };

    try {
      await createNotification({
        userId: order.customerId,
        userRole: 'CONSUMER',
        title: `Fuel Order ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        message: statusMessages[status as keyof typeof statusMessages] || `Your fuel order status has been updated to ${status}`,
        type: 'FUEL_ORDER',
        relatedId: id,
        priority: status === 'DELIVERED' || status === 'CANCELLED' ? 'HIGH' : 'MEDIUM',
        actionUrl: `/fuel/orders/${id}`,
      });
    } catch (notificationError) {
      console.error('Failed to create fuel order status notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Fuel order status updated successfully',
      data: updatedOrder[0],
    });
  } catch (error) {
    console.error('Update fuel order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get fuel inventory for merchant
router.get('/inventory', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const { fuelType, available } = req.query;

    let whereConditions = [eq(fuelInventory.merchantId, merchantId)];
    
    if (fuelType) {
      whereConditions.push(eq(fuelInventory.fuelType, fuelType as any));
    }
    
    if (available !== undefined) {
      whereConditions.push(eq(fuelInventory.isAvailable, available === 'true'));
    }

    const inventory = await db.select()
      .from(fuelInventory)
      .where(and(...whereConditions))
      .orderBy(desc(fuelInventory.createdAt));

    res.json({
      status: 'Success',
      message: 'Fuel inventory fetched successfully',
      data: inventory,
    });
  } catch (error) {
    console.error('Get fuel inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update fuel inventory
router.put('/inventory', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const inventoryUpdates = req.body; // Array of inventory updates

    if (!Array.isArray(inventoryUpdates)) {
      return res.status(400).json({ error: 'Expected an array of inventory updates' });
    }

    const updatedInventory = [];

    for (const update of inventoryUpdates) {
      const { id, quantity, pricePerUnit, isAvailable, minimumOrderQuantity, maximumOrderQuantity } = update;

      if (!id) {
        continue; // Skip invalid updates
      }

      // Verify inventory belongs to merchant
      const existingInventory = await db.select().from(fuelInventory).where(and(
        eq(fuelInventory.id, id),
        eq(fuelInventory.merchantId, merchantId)
      ));

      if (existingInventory.length === 0) {
        continue; // Skip if not found or not owned by merchant
      }

      const updateData: any = { updatedAt: new Date() };

      if (quantity !== undefined) updateData.quantity = quantity.toString();
      if (pricePerUnit !== undefined) updateData.pricePerUnit = pricePerUnit.toString();
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
      if (minimumOrderQuantity !== undefined) updateData.minimumOrderQuantity = minimumOrderQuantity.toString();
      if (maximumOrderQuantity !== undefined) updateData.maximumOrderQuantity = maximumOrderQuantity.toString();

      const updated = await db.update(fuelInventory)
        .set(updateData)
        .where(eq(fuelInventory.id, id))
        .returning();

      if (updated.length > 0) {
        updatedInventory.push(updated[0]);
      }
    }

    res.json({
      status: 'Success',
      message: 'Fuel inventory updated successfully',
      data: updatedInventory,
    });
  } catch (error) {
    console.error('Update fuel inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new fuel inventory item
router.post('/inventory', authenticateToken, authorizeRoles('MERCHANT'), async (req, res) => {
  try {
    const merchantId = (req as any).user.userId;
    const {
      fuelType,
      quantity,
      unit,
      pricePerUnit,
      minimumOrderQuantity,
      maximumOrderQuantity,
      location,
      description
    } = req.body;

    if (!fuelType || !quantity || !unit || !pricePerUnit) {
      return res.status(400).json({ 
        error: 'Fuel type, quantity, unit, and price per unit are required' 
      });
    }

    const newInventoryItem = await db.insert(fuelInventory).values({
      merchantId,
      fuelType: fuelType as any,
      quantity: quantity.toString(),
      unit: unit as any,
      pricePerUnit: pricePerUnit.toString(),
      minimumOrderQuantity: minimumOrderQuantity?.toString() || '1',
      maximumOrderQuantity: maximumOrderQuantity?.toString(),
      location,
      description,
    }).returning();

    res.status(201).json({
      status: 'Success',
      message: 'Fuel inventory item added successfully',
      data: newInventoryItem[0],
    });
  } catch (error) {
    console.error('Add fuel inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===============================
// DRIVER ENDPOINTS
// ===============================

// Get assigned fuel deliveries for drivers
router.get('/deliveries', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const driverId = (req as any).user.userId;
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(fuelOrders.driverId, driverId)];
    
    if (status) {
      whereConditions.push(eq(fuelOrders.status, status as any));
    }

    const driverDeliveries = await db.select({
      id: fuelOrders.id,
      orderNumber: fuelOrders.orderNumber,
      orderType: fuelOrders.orderType,
      fuelType: fuelOrders.fuelType,
      quantity: fuelOrders.quantity,
      unit: fuelOrders.unit,
      totalPrice: fuelOrders.totalPrice,
      deliveryAddress: fuelOrders.deliveryAddress,
      deliveryDate: fuelOrders.deliveryDate,
      status: fuelOrders.status,
      specialInstructions: fuelOrders.specialInstructions,
      estimatedDeliveryTime: fuelOrders.estimatedDeliveryTime,
      actualDeliveryTime: fuelOrders.actualDeliveryTime,
      createdAt: fuelOrders.createdAt,
      customer: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
      },
      merchant: {
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        businessName: merchantProfiles.businessName,
      },
    })
      .from(fuelOrders)
      .leftJoin(users, eq(fuelOrders.customerId, users.id))
      .leftJoin(alias(users, 'merchant'), eq(fuelOrders.merchantId, users.id))
      .leftJoin(merchantProfiles, eq(fuelOrders.merchantId, merchantProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(desc(fuelOrders.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Driver fuel deliveries fetched successfully',
      data: {
        deliveries: driverDeliveries,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: driverDeliveries.length,
        },
      },
    });
  } catch (error) {
    console.error('Get driver fuel deliveries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update fuel delivery status
router.put('/deliveries/:id/status', authenticateToken, authorizeRoles('DRIVER'), async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = (req as any).user.userId;
    const { status } = req.body;

    const validStatuses = ['DISPATCHED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Check if delivery belongs to the driver
    const existingOrder = await db.select().from(fuelOrders).where(and(
      eq(fuelOrders.id, Number(id)),
      eq(fuelOrders.driverId, driverId)
    ));

    if (existingOrder.length === 0) {
      return res.status(404).json({ 
        error: 'Fuel delivery not found or not assigned to you' 
      });
    }

    const order = existingOrder[0];

    // Update order status
    const updateData: any = { 
      status: status === 'EN_ROUTE' ? 'DISPATCHED' : status as any,
      updatedAt: new Date()
    };

    if (status === 'DELIVERED') {
      updateData.actualDeliveryTime = new Date();
    }

    const updatedOrder = await db.update(fuelOrders)
      .set(updateData)
      .where(eq(fuelOrders.id, Number(id)))
      .returning();

    // Create notification for customer about delivery status
    const statusMessages = {
      PICKED_UP: 'Your fuel order has been picked up and is on the way',
      EN_ROUTE: 'Your fuel delivery is en route to your location',
      DELIVERED: 'Your fuel order has been delivered successfully'
    };

    try {
      await createNotification({
        userId: order.customerId,
        userRole: 'CONSUMER',
        title: 'Fuel Delivery Update',
        message: statusMessages[status as keyof typeof statusMessages] || `Your fuel delivery status: ${status}`,
        type: 'FUEL_DELIVERY',
        relatedId: id,
        priority: status === 'DELIVERED' ? 'HIGH' : 'MEDIUM',
        actionUrl: `/fuel/orders/${id}`,
      });
    } catch (notificationError) {
      console.error('Failed to create fuel delivery status notification:', notificationError);
    }

    res.json({
      status: 'Success',
      message: 'Fuel delivery status updated successfully',
      data: updatedOrder[0],
    });
  } catch (error) {
    console.error('Update fuel delivery status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available fuel inventories (public endpoint for browsing)
router.get('/inventory/browse', async (req, res) => {
  try {
    const { fuelType, location, minPrice, maxPrice, orderType, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereConditions = [eq(fuelInventory.isAvailable, true)];
    
    if (fuelType) {
      whereConditions.push(eq(fuelInventory.fuelType, fuelType as any));
    }
    
    if (location) {
      whereConditions.push(sql`${fuelInventory.location} ILIKE ${'%' + location + '%'}`);
    }
    
    if (minPrice) {
      whereConditions.push(gte(fuelInventory.pricePerUnit, minPrice.toString()));
    }
    
    if (maxPrice) {
      whereConditions.push(lte(fuelInventory.pricePerUnit, maxPrice.toString()));
    }

    const availableInventory = await db.select({
      id: fuelInventory.id,
      fuelType: fuelInventory.fuelType,
      quantity: fuelInventory.quantity,
      unit: fuelInventory.unit,
      pricePerUnit: fuelInventory.pricePerUnit,
      minimumOrderQuantity: fuelInventory.minimumOrderQuantity,
      maximumOrderQuantity: fuelInventory.maximumOrderQuantity,
      location: fuelInventory.location,
      description: fuelInventory.description,
      merchant: {
        id: users.id,
        fullName: users.fullName,
        businessName: merchantProfiles.businessName,
        businessAddress: merchantProfiles.businessAddress,
        phone: users.phone,
        profilePicture: users.profilePicture,
      },
    })
      .from(fuelInventory)
      .leftJoin(users, eq(fuelInventory.merchantId, users.id))
      .leftJoin(merchantProfiles, eq(fuelInventory.merchantId, merchantProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(fuelInventory.pricePerUnit)
      .limit(Number(limit))
      .offset(offset);

    res.json({
      status: 'Success',
      message: 'Available fuel inventory fetched successfully',
      data: {
        inventory: availableInventory,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: availableInventory.length,
        },
      },
    });
  } catch (error) {
    console.error('Browse fuel inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
