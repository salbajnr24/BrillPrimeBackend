"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = __importDefault(require("../config/database"));
const schema_1 = require("../schema");
const auth_1 = require("../utils/auth");
const notifications_1 = require("./notifications");
const fraud_middleware_1 = require("../utils/fraud-middleware");
const router = (0, express_1.Router)();
// Environment variables for Flutterwave
const FLUTTERWAVE_BASE_URL = process.env.FLW_BASE_URL || 'https://api.flutterwave.com/v3';
const FLUTTERWAVE_SECRET_KEY = process.env.FLW_SECRET_KEY;
// Initialize payment
router.post('/initialize', auth_1.authenticateToken, async (req, res) => {
    try {
        const { amount, currency = 'NGN', customerEmail } = req.body;
        const userId = req.user?.userId;
        if (!amount || !customerEmail) {
            return res.status(400).json({ error: 'Amount and customer email are required' });
        }
        const txRef = `payment-${userId}-${Date.now()}`;
        const response = await axios_1.default.post(`${FLUTTERWAVE_BASE_URL}/payments`, {
            tx_ref: txRef,
            amount,
            currency,
            redirect_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/payment/callback`,
            customer: {
                email: customerEmail,
            },
            customizations: {
                title: 'Brillprime',
                description: 'Order Payment',
            },
        }, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        res.json({
            status: 'Success',
            message: 'Payment initialized successfully',
            data: {
                paymentLink: response.data.data.link,
                txRef: txRef,
            },
        });
    }
    catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({ error: 'Payment initialization failed' });
    }
});
// Payment callback endpoint
router.get('/callback', async (req, res) => {
    try {
        const { transaction_id, tx_ref, status } = req.query;
        if (!transaction_id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }
        const paymentData = await verifyPayment(transaction_id);
        if (paymentData === 'successful') {
            // Update order status and notify user
            const order = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.paymentTxRef, tx_ref));
            if (order.length > 0) {
                await database_1.default.update(schema_1.orders)
                    .set({ status: 'confirmed', updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, order[0].id));
                // Notify consumer about order confirmation
                await (0, notifications_1.createNotification)({
                    userId: order[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Order Confirmed',
                    message: `Your order ${order[0].id} has been confirmed and is being processed.`,
                    type: 'ORDER_UPDATE',
                    relatedId: order[0].id
                });
                // Notify merchant about new order
                await (0, notifications_1.createNotification)({
                    userId: order[0].sellerId,
                    userRole: 'MERCHANT',
                    title: 'New Order',
                    message: `You have a new order ${order[0].id} to fulfill.`,
                    type: 'NEW_ORDER',
                    relatedId: order[0].id
                });
            }
            // Redirect to success page
            return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/success?tx_ref=${tx_ref}`);
        }
        else {
            // Update order status to failed/cancelled and notify user
            const order = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.paymentTxRef, tx_ref));
            if (order.length > 0) {
                await database_1.default.update(schema_1.orders)
                    .set({ status: 'failed', updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, order[0].id));
                // Notify consumer about payment failure
                await (0, notifications_1.createNotification)({
                    userId: order[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Payment Failed',
                    message: `There was an issue processing your payment for order ${order[0].id}. Please try again.`,
                    type: 'PAYMENT_FAILED',
                    relatedId: order[0].id
                });
            }
            // Redirect to failure page
            return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/failure?tx_ref=${tx_ref}`);
        }
    }
    catch (error) {
        console.error('Payment callback error:', error);
        return res.redirect(`${process.env.APP_URL || 'http://localhost:3000'}/payment/failure`);
    }
});
// Webhook endpoint for Flutterwave notifications
router.post('/webhook', async (req, res) => {
    try {
        const { data } = req.body;
        const { tx_ref, status, transaction_id } = data;
        console.log('Webhook received:', { tx_ref, status, transaction_id });
        // Verify webhook signature if needed
        // const signature = req.headers['verif-hash'];
        if (status === 'successful') {
            // Update order status or handle successful payment
            console.log(`Payment successful for tx_ref: ${tx_ref}`);
            const order = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.paymentTxRef, tx_ref));
            if (order.length > 0) {
                await database_1.default.update(schema_1.orders)
                    .set({ status: 'confirmed', updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, order[0].id));
                // Notify consumer about order confirmation
                await (0, notifications_1.createNotification)({
                    userId: order[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Order Confirmed',
                    message: `Your order ${order[0].id} has been confirmed and is being processed.`,
                    type: 'ORDER_UPDATE',
                    relatedId: order[0].id
                });
                // Notify merchant about new order
                await (0, notifications_1.createNotification)({
                    userId: order[0].sellerId,
                    userRole: 'MERCHANT',
                    title: 'New Order',
                    message: `You have a new order ${order[0].id} to fulfill.`,
                    type: 'NEW_ORDER',
                    relatedId: order[0].id
                });
            }
        }
        else if (status === 'failed') {
            console.log(`Payment failed for tx_ref: ${tx_ref}`);
            const order = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.paymentTxRef, tx_ref));
            if (order.length > 0) {
                await database_1.default.update(schema_1.orders)
                    .set({ status: 'failed', updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(schema_1.orders.id, order[0].id));
                // Notify consumer about payment failure
                await (0, notifications_1.createNotification)({
                    userId: order[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Payment Failed',
                    message: `There was an issue processing your payment for order ${order[0].id}. Please try again.`,
                    type: 'PAYMENT_FAILED',
                    relatedId: order[0].id
                });
            }
        }
        res.status(200).json({ status: 'success' });
    }
    catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
// Verify payment
router.post('/verify', auth_1.authenticateToken, async (req, res) => {
    try {
        const { transactionId, txRef } = req.body;
        const userId = req.user?.userId;
        if (!transactionId || !txRef) {
            return res.status(400).json({ error: 'Transaction ID and txRef are required' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'User authentication required' });
        }
        const paymentStatus = await verifyPayment(transactionId);
        // Find and update related orders
        const userOrders = await database_1.default.select()
            .from(schema_1.orders)
            .where((0, drizzle_orm_1.eq)(schema_1.orders.buyerId, userId));
        let message = 'Payment verification pending';
        let newStatus = 'pending';
        if (paymentStatus === 'successful') {
            newStatus = 'confirmed';
            message = 'Payment verified successfully';
        }
        else if (paymentStatus === 'failed') {
            newStatus = 'cancelled';
            message = 'Payment verification failed';
        }
        // Update the most recent pending order
        const pendingOrder = userOrders.find(order => order.status === 'pending');
        if (pendingOrder) {
            const updatedOrder = await database_1.default.update(schema_1.orders)
                .set({
                status: newStatus,
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, pendingOrder.id))
                .returning();
            // Notify about order status update
            if (newStatus === 'confirmed') {
                await (0, notifications_1.createNotification)({
                    userId: updatedOrder[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Order Status Update',
                    message: `Your order ${updatedOrder[0].id} has been confirmed.`,
                    type: 'ORDER_UPDATE',
                    relatedId: updatedOrder[0].id
                });
                await (0, notifications_1.createNotification)({
                    userId: updatedOrder[0].sellerId,
                    userRole: 'MERCHANT',
                    title: 'New Order Confirmation',
                    message: `Order ${updatedOrder[0].id} has been confirmed.`,
                    type: 'ORDER_UPDATE',
                    relatedId: updatedOrder[0].id
                });
            }
            else if (newStatus === 'cancelled') {
                await (0, notifications_1.createNotification)({
                    userId: updatedOrder[0].buyerId,
                    userRole: 'CONSUMER',
                    title: 'Order Status Update',
                    message: `Your order ${updatedOrder[0].id} has been cancelled due to payment failure.`,
                    type: 'ORDER_CANCELLED',
                    relatedId: updatedOrder[0].id
                });
            }
            res.json({
                status: 'Success',
                message: message,
                data: {
                    order: updatedOrder[0],
                    paymentStatus: paymentStatus,
                },
            });
        }
        else {
            res.status(404).json({ error: 'No pending order found to verify' });
        }
    }
    catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});
// Process payment for order
router.post('/process', auth_1.authenticateToken, (0, fraud_middleware_1.fraudDetectionMiddleware)('PAYMENT'), async (req, res) => {
    try {
        const { orderId, amount, paymentMethod } = req.body;
        const userId = req.user?.userId;
        if (!orderId || !amount || !paymentMethod) {
            return res.status(400).json({ error: 'Order ID, amount, and payment method are required' });
        }
        // Generate transaction reference for this payment
        const txRef = `process-${userId}-${Date.now()}`;
        // Fetch order details
        const order = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        if (order.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order[0].buyerId !== userId) {
            return res.status(403).json({ error: 'You are not authorized to process this order' });
        }
        // TODO: Integrate with actual payment gateway (Stripe, Paystack, etc.)
        // For now, we'll simulate payment processing
        const paymentSuccessful = Math.random() > 0.1; // 90% success rate for demo
        if (!paymentSuccessful) {
            return res.status(400).json({
                error: 'Payment failed',
                transactionRef: `failed_${Date.now()}`,
            });
        }
        // Check for payment amount mismatch (fraud detection)
        const expectedAmount = parseFloat(order[0].totalPrice);
        const actualAmount = parseFloat(amount);
        if (Math.abs(expectedAmount - actualAmount) > 0.01) {
            await (0, fraud_middleware_1.logPaymentMismatch)(userId, expectedAmount, actualAmount, paymentMethod, txRef // Assuming txRef is available here, otherwise pass it in req.body
            );
            return res.status(400).json({
                error: 'Payment amount mismatch detected',
                expected: expectedAmount,
                received: actualAmount,
            });
        }
        // If payment is successful and amount matches, update order status
        await database_1.default.update(schema_1.orders)
            .set({ status: 'confirmed', updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        // Notify buyer and seller
        await (0, notifications_1.createNotification)({
            userId: userId,
            userRole: 'CONSUMER',
            title: 'Payment Successful',
            message: `Your payment for order ${orderId} was successful.`,
            type: 'PAYMENT_SUCCESS',
            relatedId: orderId
        });
        await (0, notifications_1.createNotification)({
            userId: order[0].sellerId,
            userRole: 'MERCHANT',
            title: 'Order Payment Received',
            message: `Payment for order ${orderId} has been received.`,
            type: 'PAYMENT_RECEIVED',
            relatedId: orderId
        });
        res.json({
            status: 'Success',
            message: 'Payment processed successfully',
            data: {
                orderId,
                transactionRef: `txn_${Date.now()}_${orderId}`, // Simulate transaction reference
                paymentStatus: 'confirmed',
            },
        });
    }
    catch (error) {
        console.error('Process payment error:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});
// Get list of banks
router.get('/banks', auth_1.authenticateToken, async (req, res) => {
    try {
        const { search } = req.query;
        const response = await axios_1.default.get('https://api.flutterwave.com/v3/banks/NG', {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            },
        });
        if (response.data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to fetch bank list' });
        }
        let banks = response.data.data;
        // Apply search filter if provided
        if (search) {
            const lowerSearch = search.toLowerCase();
            banks = banks.filter((bank) => bank.name.toLowerCase().includes(lowerSearch) ||
                bank.code.includes(search));
        }
        res.json({
            status: 'Success',
            message: 'Banks fetched successfully',
            data: banks,
        });
    }
    catch (error) {
        console.error('Get banks error:', error);
        res.status(500).json({ error: 'Failed to fetch banks' });
    }
});
// Verify bank account
router.post('/verify-account', auth_1.authenticateToken, async (req, res) => {
    try {
        const { accountNumber, bankCode } = req.body;
        if (!accountNumber || !bankCode) {
            return res.status(400).json({ error: 'Account number and bank code are required' });
        }
        const response = await axios_1.default.post('https://api.flutterwave.com/v3/accounts/resolve', {
            account_number: accountNumber,
            account_bank: bankCode,
        }, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.data.status !== 'success') {
            return res.status(400).json({ error: 'Failed to verify account' });
        }
        res.json({
            status: 'Success',
            message: 'Account verified successfully',
            data: response.data.data,
        });
    }
    catch (error) {
        console.error('Account verification error:', error);
        res.status(500).json({ error: 'Account verification failed' });
    }
});
// Settle vendor payment (transfer funds)
router.post('/settle/:orderId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        // Get order details
        const orderData = await database_1.default.select({
            id: schema_1.orders.id,
            sellerId: schema_1.orders.sellerId,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
            seller: {
                id: schema_1.users.id,
                fullName: schema_1.users.fullName,
                // Add account details fields when available in your schema
            }
        })
            .from(schema_1.orders)
            .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.orders.sellerId, schema_1.users.id))
            .where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
        if (orderData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderData[0];
        if (order.status !== 'confirmed') {
            return res.status(400).json({ error: 'Order has not been paid' });
        }
        // Note: You'll need to add account details to your users schema
        // For now, this is a placeholder for the settlement logic
        res.json({
            status: 'Success',
            message: 'Settlement initiated (implementation pending account details)',
            data: { orderId: order.id },
        });
    }
    catch (error) {
        console.error('Settlement error:', error);
        res.status(500).json({ error: 'Settlement failed' });
    }
});
// Helper function to verify payment with Flutterwave
async function verifyPayment(transactionId) {
    try {
        const response = await axios_1.default.get(`${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`, {
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data.data.status;
    }
    catch (error) {
        console.error('Payment verification error:', error);
        throw new Error('Failed to verify payment');
    }
}
// Process refund
router.post('/refund/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params; // This could be order ID or transaction ID
        const { amount, reason, refundType = 'full' } = req.body;
        const userId = req.user?.userId;
        if (!reason) {
            return res.status(400).json({ error: 'Refund reason is required' });
        }
        // Get order details
        const orderData = await database_1.default.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (orderData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderData[0];
        const userRole = req.user?.role;
        // Check permissions (merchant can refund their orders, admin can refund any)
        if (order.sellerId !== userId && userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'You do not have permission to process this refund' });
        }
        const refundAmount = amount || parseFloat(order.totalPrice);
        // In production, integrate with Flutterwave refund API
        try {
            // Example Flutterwave refund call
            /*
            const refundResponse = await axios.post(
              `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/refund`,
              {
                amount: refundAmount,
                comment: reason,
              },
              {
                headers: {
                  Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            */
            // Update order status
            await database_1.default.update(schema_1.orders)
                .set({
                status: 'cancelled',
                updatedAt: new Date()
            })
                .where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
            const refundData = {
                orderId: id,
                refundAmount,
                refundType,
                reason,
                status: 'PROCESSING',
                referenceId: `REF-${Date.now()}-${id}`,
                processedAt: new Date(),
            };
            // Notify relevant parties about the refund
            await (0, notifications_1.createNotification)({
                userId: order.buyerId,
                userRole: 'CONSUMER',
                title: 'Refund Processed',
                message: `Your refund for order ${id} has been initiated.`,
                type: 'REFUND_PROCESSED',
                relatedId: id
            });
            await (0, notifications_1.createNotification)({
                userId: order.sellerId,
                userRole: 'MERCHANT',
                title: 'Refund Issued',
                message: `A refund has been issued for order ${id}.`,
                type: 'REFUND_ISSUED',
                relatedId: id
            });
            res.json({
                status: 'Success',
                message: 'Refund processed successfully',
                data: refundData,
            });
        }
        catch (refundError) {
            console.error('Refund processing error:', refundError);
            res.status(500).json({ error: 'Failed to process refund' });
        }
    }
    catch (error) {
        console.error('Process refund error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create payment dispute
router.post('/dispute/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params; // Order or transaction ID
        const userId = req.user.userId;
        const { disputeReason, description, evidence } = req.body;
        if (!disputeReason || !description) {
            return res.status(400).json({
                error: 'Dispute reason and description are required'
            });
        }
        // Get order details
        const orderData = await database_1.default.select({
            id: schema_1.orders.id,
            buyerId: schema_1.orders.buyerId,
            sellerId: schema_1.orders.sellerId,
            totalPrice: schema_1.orders.totalPrice,
            status: schema_1.orders.status,
        }).from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, id));
        if (orderData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderData[0];
        // Check if user is involved in the order
        if (order.buyerId !== userId && order.sellerId !== userId) {
            return res.status(403).json({ error: 'You are not authorized to dispute this payment' });
        }
        // Create dispute record (in production, store in disputes table)
        const disputeData = {
            disputeId: `DISPUTE-${Date.now()}-${id}`,
            orderId: id,
            initiatedBy: userId,
            disputeReason,
            description,
            evidence: evidence || [],
            status: 'PENDING',
            createdAt: new Date(),
            amount: order.totalPrice,
        };
        // Notify relevant parties about the dispute
        await (0, notifications_1.createNotification)({
            userId: order.buyerId,
            userRole: 'CONSUMER',
            title: 'Dispute Created',
            message: `A dispute has been filed for your order ${id}.`,
            type: 'DISPUTE_CREATED',
            relatedId: id
        });
        await (0, notifications_1.createNotification)({
            userId: order.sellerId,
            userRole: 'MERCHANT',
            title: 'Dispute Filed',
            message: `A dispute has been filed against your order ${id}.`,
            type: 'DISPUTE_FILED',
            relatedId: id
        });
        res.json({
            status: 'Success',
            message: 'Payment dispute created successfully',
            data: disputeData,
        });
    }
    catch (error) {
        console.error('Create dispute error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Request payout (merchant/driver)
router.post('/payout', auth_1.authenticateToken, (0, auth_1.authorizeRoles)('MERCHANT', 'DRIVER'), (0, fraud_middleware_1.fraudDetectionMiddleware)('WITHDRAWAL'), async (req, res) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const { amount, bankAccount, accountNumber, bankCode, notes } = req.body;
        if (!amount || !bankAccount || !accountNumber || !bankCode) {
            return res.status(400).json({
                error: 'Amount and bank details are required'
            });
        }
        // Check user role
        if (!['MERCHANT', 'DRIVER'].includes(userRole)) {
            return res.status(403).json({ error: 'Only merchants and drivers can request payouts' });
        }
        let availableBalance = 0;
        if (userRole === 'MERCHANT') {
            // Calculate merchant available balance from completed orders
            const merchantEarnings = await database_1.default.select({
                totalEarnings: (0, drizzle_orm_1.sql) `sum(${schema_1.orders.totalPrice})`,
            })
                .from(schema_1.orders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.orders.sellerId, userId), (0, drizzle_orm_1.eq)(schema_1.orders.status, 'delivered')));
            availableBalance = parseFloat(merchantEarnings[0]?.totalEarnings || '0');
        }
        else if (userRole === 'DRIVER') {
            // Calculate driver available balance from completed deliveries
            const driverEarnings = await database_1.default.select({
                totalEarnings: (0, drizzle_orm_1.sql) `sum(${schema_1.deliveryRequests.deliveryFee})`,
            })
                .from(schema_1.deliveryRequests)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.deliveryRequests.driverId, userId), (0, drizzle_orm_1.eq)(schema_1.deliveryRequests.status, 'DELIVERED')));
            availableBalance = parseFloat(driverEarnings[0]?.totalEarnings || '0');
        }
        if (amount > availableBalance) {
            return res.status(400).json({
                error: `Insufficient balance. Available: ${availableBalance}`
            });
        }
        // Create payout request
        const payoutRequest = {
            payoutId: `PAYOUT-${Date.now()}-${userId}`,
            userId,
            userRole,
            amount,
            bankAccount,
            accountNumber,
            bankCode,
            notes: notes || '',
            status: 'PENDING',
            requestedAt: new Date(),
            availableBalance,
        };
        // Notify user about payout request submission
        await (0, notifications_1.createNotification)({
            userId: userId,
            userRole: 'MERCHANT',
            title: 'Payout Request Submitted',
            message: `Your payout request of ${amount} has been submitted and is pending approval.`,
            type: 'PAYOUT_REQUEST',
            relatedId: payoutRequest.payoutId
        });
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
// Get payout history
router.get('/payout/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const { page = 1, limit = 10, status } = req.query;
        if (!['MERCHANT', 'DRIVER'].includes(userRole)) {
            return res.status(403).json({ error: 'Only merchants and drivers can view payout history' });
        }
        // In production, this would fetch from a payouts table
        // For now, return mock data
        const mockPayouts = [
            {
                payoutId: `PAYOUT-${Date.now()}-${userId}`,
                amount: '5000.00',
                status: 'COMPLETED',
                requestedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                processedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
                bankAccount: '**** **** **** 1234',
            },
            {
                payoutId: `PAYOUT-${Date.now() - 1000}-${userId}`,
                amount: '3000.00',
                status: 'PENDING',
                requestedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
                bankAccount: '**** **** **** 1234',
            },
        ];
        const filteredPayouts = status
            ? mockPayouts.filter(p => p.status === status)
            : mockPayouts;
        res.json({
            status: 'Success',
            message: 'Payout history fetched successfully',
            data: {
                payouts: filteredPayouts,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: filteredPayouts.length,
                },
            },
        });
    }
    catch (error) {
        console.error('Get payout history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Report system
router.post('/api/report/user/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params; // User ID to report
        const { reason, description } = req.body;
        const reporterId = req.user.userId;
        if (!reason || !description) {
            return res.status(400).json({ error: 'Reason and description are required for reporting.' });
        }
        // In a real application, you would insert this into a 'reports' table
        // For now, we'll log it and notify an admin/moderator.
        console.log(`User ${reporterId} reported user ${id} for: ${reason} - ${description}`);
        // Example: Notify an admin user (assuming you have an 'ADMIN' role and a way to find them)
        // await createNotification('adminUserId', 'New User Report', `User ${id} has been reported by ${reporterId}.`);
        res.status(200).json({ message: 'User reported successfully. This report will be reviewed.' });
    }
    catch (error) {
        console.error('Error reporting user:', error);
        res.status(500).json({ error: 'Failed to submit report.' });
    }
});
router.post('/api/report/product/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params; // Product ID to report
        const { reason, description } = req.body;
        const reporterId = req.user.userId;
        if (!reason || !description) {
            return res.status(400).json({ error: 'Reason and description are required for reporting.' });
        }
        // In a real application, you would insert this into a 'reports' table
        // For now, we'll log it and notify an admin/moderator.
        console.log(`User ${reporterId} reported product ${id} for: ${reason} - ${description}`);
        // Example: Notify an admin user
        // await createNotification('adminUserId', 'New Product Report', `Product ${id} has been reported by ${reporterId}.`);
        res.status(200).json({ message: 'Product reported successfully. This report will be reviewed.' });
    }
    catch (error) {
        console.error('Error reporting product:', error);
        res.status(500).json({ error: 'Failed to submit report.' });
    }
});
exports.default = router;
//# sourceMappingURL=payment.js.map