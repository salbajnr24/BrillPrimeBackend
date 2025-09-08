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
// ===============================
// CONSUMER ENDPOINTS
// ===============================
// Place a new fuel order
router.post('/order', auth_1.authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.userId;
        const { inventoryId, orderType, quantity, deliveryAddress, deliveryDate, specialInstructions } = req.body;
        if (!inventoryId || !orderType || !quantity || !deliveryAddress) {
            return res.status(400).json({
                error: 'Inventory ID, order type, quantity, and delivery address are required'
            });
        }
        // Get fuel inventory details
        const inventory = await database_1.default.select({
            id: schema_1.fuelInventory.id,
            merchantId: schema_1.fuelInventory.merchantId,
            fuelType: schema_1.fuelInventory.fuelType,
            quantity: schema_1.fuelInventory.quantity,
            unit: schema_1.fuelInventory.unit,
            pricePerUnit: schema_1.fuelInventory.pricePerUnit,
            minimumOrderQuantity: schema_1.fuelInventory.minimumOrderQuantity,
            maximumOrderQuantity: schema_1.fuelInventory.maximumOrderQuantity,
            isAvailable: schema_1.fuelInventory.isAvailable,
            merchant: {
                fullName: schema_1.users.fullName,
                location: schema_1.merchantProfiles.businessAddress,
            },
        })
            .from(schema_1.fuelInventory)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, inventoryId));
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
        const newOrder = await database_1.default.insert(schema_1.fuelOrders).values({
            customerId,
            merchantId: inventoryData.merchantId,
            inventoryId,
            orderType: orderType,
            fuelType: inventoryData.fuelType,
            quantity: quantity.toString(),
            unit: inventoryData.unit,
            pricePerUnit: inventoryData.pricePerUnit,
            totalPrice: totalPrice.toString(),
            deliveryAddress,
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            specialInstructions,
            orderNumber,
        }).returning();
        // Update inventory quantity
        const newInventoryQuantity = availableQuantity - orderQuantity;
        await database_1.default.update(schema_1.fuelInventory)
            .set({
            quantity: newInventoryQuantity.toString(),
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, inventoryId));
        // Notify merchant about new fuel order
        try {
            await (0, notifications_1.createNotification)({
                userId: inventoryData.merchantId,
                userRole: 'MERCHANT',
                title: 'New Fuel Order',
                message: `New ${orderType.toLowerCase()} fuel order: ${quantity} ${inventoryData.unit} of ${inventoryData.fuelType}`,
                type: 'FUEL_ORDER',
                relatedId: newOrder[0].id.toString(),
                priority: orderType === 'BULK' ? 'HIGH' : 'MEDIUM',
                actionUrl: `/fuel/merchant/orders/${newOrder[0].id}`,
            });
        }
        catch (notificationError) {
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
    }
    catch (error) {
        console.error('Place fuel order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's fuel orders
router.get('/orders', auth_1.authenticateToken, async (req, res) => {
    try {
        const customerId = req.user.userId;
        const { page = 1, limit = 10, status, orderType } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.fuelOrders.customerId, customerId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelOrders.status, status));
        }
        if (orderType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelOrders.orderType, orderType));
        }
        const userFuelOrders = await database_1.default.select({
            id: schema_1.fuelOrders.id,
            orderNumber: schema_1.fuelOrders.orderNumber,
            orderType: schema_1.fuelOrders.orderType,
            fuelType: schema_1.fuelOrders.fuelType,
            quantity: schema_1.fuelOrders.quantity,
            unit: schema_1.fuelOrders.unit,
            pricePerUnit: schema_1.fuelOrders.pricePerUnit,
            totalPrice: schema_1.fuelOrders.totalPrice,
            deliveryAddress: schema_1.fuelOrders.deliveryAddress,
            deliveryDate: schema_1.fuelOrders.deliveryDate,
            status: schema_1.fuelOrders.status,
            paymentStatus: schema_1.fuelOrders.paymentStatus,
            estimatedDeliveryTime: schema_1.fuelOrders.estimatedDeliveryTime,
            actualDeliveryTime: schema_1.fuelOrders.actualDeliveryTime,
            createdAt: schema_1.fuelOrders.createdAt,
            merchant: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                businessName: schema_1.merchantProfiles.businessName,
                businessAddress: schema_1.merchantProfiles.businessAddress,
            },
        })
            .from(schema_1.fuelOrders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.fuelOrders.createdAt))
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
    }
    catch (error) {
        console.error('Get fuel orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get details of a specific fuel order
router.get('/orders/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.userId;
        const fuelOrder = await database_1.default.select({
            id: schema_1.fuelOrders.id,
            orderNumber: schema_1.fuelOrders.orderNumber,
            orderType: schema_1.fuelOrders.orderType,
            fuelType: schema_1.fuelOrders.fuelType,
            quantity: schema_1.fuelOrders.quantity,
            unit: schema_1.fuelOrders.unit,
            pricePerUnit: schema_1.fuelOrders.pricePerUnit,
            totalPrice: schema_1.fuelOrders.totalPrice,
            deliveryAddress: schema_1.fuelOrders.deliveryAddress,
            deliveryDate: schema_1.fuelOrders.deliveryDate,
            status: schema_1.fuelOrders.status,
            paymentStatus: schema_1.fuelOrders.paymentStatus,
            specialInstructions: schema_1.fuelOrders.specialInstructions,
            estimatedDeliveryTime: schema_1.fuelOrders.estimatedDeliveryTime,
            actualDeliveryTime: schema_1.fuelOrders.actualDeliveryTime,
            createdAt: schema_1.fuelOrders.createdAt,
            updatedAt: schema_1.fuelOrders.updatedAt,
            merchant: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
                businessName: schema_1.merchantProfiles.businessName,
                businessAddress: schema_1.merchantProfiles.businessAddress,
            },
            driver: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.fuelOrders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.merchantProfiles.userId))
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.driverId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.fuelOrders.customerId, customerId)));
        if (fuelOrder.length === 0) {
            return res.status(404).json({ error: 'Fuel order not found' });
        }
        res.json({
            status: 'Success',
            message: 'Fuel order details fetched successfully',
            data: fuelOrder[0],
        });
    }
    catch (error) {
        console.error('Get fuel order details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Cancel fuel order
router.put('/orders/:id/cancel', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.userId;
        const { reason } = req.body;
        // Check if order belongs to the customer and can be cancelled
        const existingOrder = await database_1.default.select().from(schema_1.fuelOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.fuelOrders.customerId, customerId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({ error: 'Fuel order not found' });
        }
        const order = existingOrder[0];
        // Only allow cancellation for pending, confirmed orders
        if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
            return res.status(400).json({
                error: 'Order cannot be cancelled at this stage'
            });
        }
        // Update order status
        const updatedOrder = await database_1.default.update(schema_1.fuelOrders)
            .set({
            status: 'CANCELLED',
            updatedAt: new Date()
        })
            .where((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)))
            .returning();
        // Restore inventory quantity
        const orderQuantity = parseFloat(order.quantity);
        const currentInventory = await database_1.default.select().from(schema_1.fuelInventory).where((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, order.inventoryId));
        if (currentInventory.length > 0) {
            const newQuantity = parseFloat(currentInventory[0].quantity) + orderQuantity;
            await database_1.default.update(schema_1.fuelInventory)
                .set({
                quantity: newQuantity.toString(),
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, order.inventoryId));
        }
        // Notify merchant about cancellation
        try {
            await (0, notifications_1.createNotification)({
                userId: order.merchantId,
                userRole: 'MERCHANT',
                title: 'Fuel Order Cancelled',
                message: `Order ${order.orderNumber} has been cancelled by the customer`,
                type: 'FUEL_ORDER',
                relatedId: id,
                priority: 'MEDIUM',
                actionUrl: `/fuel/merchant/orders/${id}`,
            });
        }
        catch (notificationError) {
            console.error('Failed to create cancellation notification:', notificationError);
        }
        res.json({
            status: 'Success',
            message: 'Fuel order cancelled successfully',
            data: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Cancel fuel order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ===============================
// MERCHANT/DISTRIBUTOR ENDPOINTS
// ===============================
// Get incoming fuel orders for merchants
router.get('/merchant/orders', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { page = 1, limit = 10, status, orderType } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, merchantId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelOrders.status, status));
        }
        if (orderType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelOrders.orderType, orderType));
        }
        const merchantOrders = await database_1.default.select({
            id: schema_1.fuelOrders.id,
            orderNumber: schema_1.fuelOrders.orderNumber,
            orderType: schema_1.fuelOrders.orderType,
            fuelType: schema_1.fuelOrders.fuelType,
            quantity: schema_1.fuelOrders.quantity,
            unit: schema_1.fuelOrders.unit,
            pricePerUnit: schema_1.fuelOrders.pricePerUnit,
            totalPrice: schema_1.fuelOrders.totalPrice,
            deliveryAddress: schema_1.fuelOrders.deliveryAddress,
            deliveryDate: schema_1.fuelOrders.deliveryDate,
            status: schema_1.fuelOrders.status,
            paymentStatus: schema_1.fuelOrders.paymentStatus,
            specialInstructions: schema_1.fuelOrders.specialInstructions,
            estimatedDeliveryTime: schema_1.fuelOrders.estimatedDeliveryTime,
            createdAt: schema_1.fuelOrders.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                email: schema_1.users.email,
            },
        })
            .from(schema_1.fuelOrders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.customerId, schema_1.users.id))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.fuelOrders.createdAt))
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
    }
    catch (error) {
        console.error('Get merchant fuel orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update fuel order status
router.put('/orders/:id/status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const { id } = req.params;
        const merchantId = req.user.userId;
        const { status, estimatedDeliveryTime } = req.body;
        const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        // Check if order belongs to the merchant
        const existingOrder = await database_1.default.select().from(schema_1.fuelOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, merchantId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Fuel order not found or you do not have permission to update it'
            });
        }
        const order = existingOrder[0];
        // Update order status
        const updateData = {
            status: status,
            updatedAt: new Date()
        };
        if (estimatedDeliveryTime) {
            updateData.estimatedDeliveryTime = new Date(estimatedDeliveryTime);
        }
        if (status === 'DELIVERED') {
            updateData.actualDeliveryTime = new Date();
        }
        const updatedOrder = await database_1.default.update(schema_1.fuelOrders)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)))
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
            await (0, notifications_1.createNotification)({
                userId: order.customerId,
                userRole: 'CONSUMER',
                title: `Fuel Order ${status.charAt(0) + status.slice(1).toLowerCase()}`,
                message: statusMessages[status] || `Your fuel order status has been updated to ${status}`,
                type: 'FUEL_ORDER',
                relatedId: id,
                priority: status === 'DELIVERED' || status === 'CANCELLED' ? 'HIGH' : 'MEDIUM',
                actionUrl: `/fuel/orders/${id}`,
            });
        }
        catch (notificationError) {
            console.error('Failed to create fuel order status notification:', notificationError);
        }
        res.json({
            status: 'Success',
            message: 'Fuel order status updated successfully',
            data: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Update fuel order status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get fuel inventory for merchant
router.get('/inventory', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { fuelType, available } = req.query;
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, merchantId)];
        if (fuelType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelInventory.fuelType, fuelType));
        }
        if (available !== undefined) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelInventory.isAvailable, available === 'true'));
        }
        const inventory = await database_1.default.select()
            .from(schema_1.fuelInventory)
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.fuelInventory.createdAt));
        res.json({
            status: 'Success',
            message: 'Fuel inventory fetched successfully',
            data: inventory,
        });
    }
    catch (error) {
        console.error('Get fuel inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update fuel inventory
router.put('/inventory', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
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
            const existingInventory = await database_1.default.select().from(schema_1.fuelInventory).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, id), (0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, merchantId)));
            if (existingInventory.length === 0) {
                continue; // Skip if not found or not owned by merchant
            }
            const updateData = { updatedAt: new Date() };
            if (quantity !== undefined)
                updateData.quantity = quantity.toString();
            if (pricePerUnit !== undefined)
                updateData.pricePerUnit = pricePerUnit.toString();
            if (isAvailable !== undefined)
                updateData.isAvailable = isAvailable;
            if (minimumOrderQuantity !== undefined)
                updateData.minimumOrderQuantity = minimumOrderQuantity.toString();
            if (maximumOrderQuantity !== undefined)
                updateData.maximumOrderQuantity = maximumOrderQuantity.toString();
            const updated = await database_1.default.update(schema_1.fuelInventory)
                .set(updateData)
                .where((0, drizzle_orm_1.eq)(schema_1.fuelInventory.id, id))
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
    }
    catch (error) {
        console.error('Update fuel inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add new fuel inventory item
router.post('/inventory', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT'), async (req, res) => {
    try {
        const merchantId = req.user.userId;
        const { fuelType, quantity, unit, pricePerUnit, minimumOrderQuantity, maximumOrderQuantity, location, description } = req.body;
        if (!fuelType || !quantity || !unit || !pricePerUnit) {
            return res.status(400).json({
                error: 'Fuel type, quantity, unit, and price per unit are required'
            });
        }
        const newInventoryItem = await database_1.default.insert(schema_1.fuelInventory).values({
            merchantId,
            fuelType: fuelType,
            quantity: quantity.toString(),
            unit: unit,
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
    }
    catch (error) {
        console.error('Add fuel inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ===============================
// DRIVER ENDPOINTS
// ===============================
// Get assigned fuel deliveries for drivers
router.get('/deliveries', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const driverId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.fuelOrders.driverId, driverId)];
        if (status) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelOrders.status, status));
        }
        const driverDeliveries = await database_1.default.select({
            id: schema_1.fuelOrders.id,
            orderNumber: schema_1.fuelOrders.orderNumber,
            orderType: schema_1.fuelOrders.orderType,
            fuelType: schema_1.fuelOrders.fuelType,
            quantity: schema_1.fuelOrders.quantity,
            unit: schema_1.fuelOrders.unit,
            totalPrice: schema_1.fuelOrders.totalPrice,
            deliveryAddress: schema_1.fuelOrders.deliveryAddress,
            deliveryDate: schema_1.fuelOrders.deliveryDate,
            status: schema_1.fuelOrders.status,
            specialInstructions: schema_1.fuelOrders.specialInstructions,
            estimatedDeliveryTime: schema_1.fuelOrders.estimatedDeliveryTime,
            actualDeliveryTime: schema_1.fuelOrders.actualDeliveryTime,
            createdAt: schema_1.fuelOrders.createdAt,
            customer: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
            },
            merchant: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                phone: schema_1.users.phone,
                businessName: schema_1.merchantProfiles.businessName,
            },
        })
            .from(schema_1.fuelOrders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.customerId, schema_1.users.id))
            .leftJoin(schema_1.users.as('merchant'), (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.fuelOrders.merchantId, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.fuelOrders.createdAt))
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
    }
    catch (error) {
        console.error('Get driver fuel deliveries error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update fuel delivery status
router.put('/deliveries/:id/status', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('DRIVER'), async (req, res) => {
    try {
        const { id } = req.params;
        const driverId = req.user.userId;
        const { status } = req.body;
        const validStatuses = ['DISPATCHED', 'PICKED_UP', 'EN_ROUTE', 'DELIVERED'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        // Check if delivery belongs to the driver
        const existingOrder = await database_1.default.select().from(schema_1.fuelOrders).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)), (0, drizzle_orm_1.eq)(schema_1.fuelOrders.driverId, driverId)));
        if (existingOrder.length === 0) {
            return res.status(404).json({
                error: 'Fuel delivery not found or not assigned to you'
            });
        }
        const order = existingOrder[0];
        // Update order status
        const updateData = {
            status: status === 'EN_ROUTE' ? 'DISPATCHED' : status,
            updatedAt: new Date()
        };
        if (status === 'DELIVERED') {
            updateData.actualDeliveryTime = new Date();
        }
        const updatedOrder = await database_1.default.update(schema_1.fuelOrders)
            .set(updateData)
            .where((0, drizzle_orm_1.eq)(schema_1.fuelOrders.id, Number(id)))
            .returning();
        // Create notification for customer about delivery status
        const statusMessages = {
            PICKED_UP: 'Your fuel order has been picked up and is on the way',
            EN_ROUTE: 'Your fuel delivery is en route to your location',
            DELIVERED: 'Your fuel order has been delivered successfully'
        };
        try {
            await (0, notifications_1.createNotification)({
                userId: order.customerId,
                userRole: 'CONSUMER',
                title: 'Fuel Delivery Update',
                message: statusMessages[status] || `Your fuel delivery status: ${status}`,
                type: 'FUEL_DELIVERY',
                relatedId: id,
                priority: status === 'DELIVERED' ? 'HIGH' : 'MEDIUM',
                actionUrl: `/fuel/orders/${id}`,
            });
        }
        catch (notificationError) {
            console.error('Failed to create fuel delivery status notification:', notificationError);
        }
        res.json({
            status: 'Success',
            message: 'Fuel delivery status updated successfully',
            data: updatedOrder[0],
        });
    }
    catch (error) {
        console.error('Update fuel delivery status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get available fuel inventories (public endpoint for browsing)
router.get('/inventory/browse', async (req, res) => {
    try {
        const { fuelType, location, minPrice, maxPrice, orderType, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereConditions = [(0, drizzle_orm_1.eq)(schema_1.fuelInventory.isAvailable, true)];
        if (fuelType) {
            whereConditions.push((0, drizzle_orm_1.eq)(schema_1.fuelInventory.fuelType, fuelType));
        }
        if (location) {
            whereConditions.push((0, drizzle_orm_1.sql) `${schema_1.fuelInventory.location} ILIKE ${'%' + location + '%'}`);
        }
        if (minPrice) {
            whereConditions.push((0, drizzle_orm_1.gte)(schema_1.fuelInventory.pricePerUnit, minPrice.toString()));
        }
        if (maxPrice) {
            whereConditions.push((0, drizzle_orm_1.lte)(schema_1.fuelInventory.pricePerUnit, maxPrice.toString()));
        }
        const availableInventory = await database_1.default.select({
            id: schema_1.fuelInventory.id,
            fuelType: schema_1.fuelInventory.fuelType,
            quantity: schema_1.fuelInventory.quantity,
            unit: schema_1.fuelInventory.unit,
            pricePerUnit: schema_1.fuelInventory.pricePerUnit,
            minimumOrderQuantity: schema_1.fuelInventory.minimumOrderQuantity,
            maximumOrderQuantity: schema_1.fuelInventory.maximumOrderQuantity,
            location: schema_1.fuelInventory.location,
            description: schema_1.fuelInventory.description,
            merchant: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                businessName: schema_1.merchantProfiles.businessName,
                businessAddress: schema_1.merchantProfiles.businessAddress,
                phone: schema_1.users.phone,
                profilePicture: schema_1.users.profilePicture,
            },
        })
            .from(schema_1.fuelInventory)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, schema_1.users.id))
            .leftJoin(schema_1.merchantProfiles, (0, drizzle_orm_1.eq)(schema_1.fuelInventory.merchantId, schema_1.merchantProfiles.userId))
            .where((0, drizzle_orm_1.and)(...whereConditions))
            .orderBy(schema_1.fuelInventory.pricePerUnit)
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
    }
    catch (error) {
        console.error('Browse fuel inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=fuel.js.map