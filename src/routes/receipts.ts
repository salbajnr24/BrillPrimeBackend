import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import db from '../config/database';
import { receipts, orders, users, products } from '../schema';
import { authenticateToken, authorizeRoles } from '../utils/auth';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Ensure receipts directory exists
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
const qrCodesDir = path.join(__dirname, '../../uploads/qr-codes');

[receiptsDir, qrCodesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Generate receipt and QR code for completed order
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod,
      transactionRef,
      driverId,
      metadata = {}
    } = req.body;

    if (!orderId || !paymentMethod) {
      return res.status(400).json({ error: 'Order ID and payment method are required' });
    }

    // Get order details with related information
    const orderDetails = await db.select({
      order: orders,
      customer: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      },
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
      },
    })
      .from(orders)
      .leftJoin(users, eq(orders.buyerId, users.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(orders.id, orderId));

    if (orderDetails.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get merchant details separately
    const merchantDetails = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
    })
      .from(users)
      .where(eq(users.id, orderDetails[0].order.sellerId));

    if (orderDetails.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDetails[0];
    const merchantData = merchantDetails[0];

    // Check if receipt already exists for this order
    const existingReceipt = await db.select()
      .from(receipts)
      .where(eq(receipts.orderId, orderId));

    if (existingReceipt.length > 0) {
      return res.status(400).json({ 
        error: 'Receipt already exists for this order',
        receipt: existingReceipt[0]
      });
    }

    // Generate receipt number
    const receiptNumber = `BP-REC-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;

    // Create QR code data
    const qrData = JSON.stringify({
      receiptNumber,
      orderId,
      customerId: orderData.customer?.id,
      merchantId: merchantData?.id,
      totalAmount: orderData.order.totalPrice,
      timestamp: new Date().toISOString(),
      type: 'BRILLPRIME_RECEIPT'
    });

    // Generate QR code image
    const qrCodeFileName = `qr-${receiptNumber}.png`;
    const qrCodePath = path.join(qrCodesDir, qrCodeFileName);
    
    await QRCode.toFile(qrCodePath, qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const qrCodeImageUrl = `/uploads/qr-codes/${qrCodeFileName}`;

    // Generate PDF receipt
    const receiptPdfFileName = `receipt-${receiptNumber}.pdf`;
    const receiptPdfPath = path.join(receiptsDir, receiptPdfFileName);
    
    await generateReceiptPDF(receiptPdfPath, {
      receiptNumber,
      orderData: {
        ...orderData,
        merchant: merchantData
      },
      qrCodePath,
      paymentMethod,
      transactionRef,
    });

    const receiptPdfUrl = `/uploads/receipts/${receiptPdfFileName}`;

    // Save receipt to database
    const newReceipt = await db.insert(receipts).values({
      receiptNumber,
      orderId,
      customerId: orderData.customer?.id || 0,
      merchantId: merchantData?.id || 0,
      driverId: driverId ? Number(driverId) : null,
      totalAmount: orderData.order.totalPrice,
      paymentMethod,
      paymentStatus: 'COMPLETED',
      transactionRef,
      qrCodeData: qrData,
      qrCodeImageUrl,
      receiptPdfUrl,
      deliveryStatus: 'PENDING',
      metadata,
    }).returning();

    res.status(201).json({
      message: 'Receipt generated successfully',
      receipt: {
        id: newReceipt[0].id,
        receiptNumber: newReceipt[0].receiptNumber,
        totalAmount: newReceipt[0].totalAmount,
        paymentStatus: newReceipt[0].paymentStatus,
        qrCodeImageUrl: newReceipt[0].qrCodeImageUrl,
        receiptPdfUrl: newReceipt[0].receiptPdfUrl,
        createdAt: newReceipt[0].createdAt,
      },
    });
  } catch (error) {
    console.error('Generate receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get receipt details
router.get('/:receiptNumber', async (req, res) => {
  try {
    const { receiptNumber } = req.params;

    const receiptData = await db.select({
      receipt: receipts,
      order: orders,
      product: {
        id: products.id,
        name: products.name,
        price: products.price,
        unit: products.unit,
      },
    })
      .from(receipts)
      .leftJoin(orders, eq(receipts.orderId, orders.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(receipts.receiptNumber, receiptNumber));

    if (receiptData.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receipt = receiptData[0];

    // Get customer, merchant, and driver details separately
    const [customerData, merchantData, driverData] = await Promise.all([
      db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      }).from(users).where(eq(users.id, receipt.receipt.customerId)),
      
      db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      }).from(users).where(eq(users.id, receipt.receipt.merchantId)),
      
      receipt.receipt.driverId ? 
        db.select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        }).from(users).where(eq(users.id, receipt.receipt.driverId))
        : Promise.resolve([])
    ]);

    const responseData = {
      receipt: receipt.receipt,
      customer: customerData[0] || null,
      merchant: merchantData[0] || null,
      driver: driverData[0] || null,
      order: receipt.order,
      product: receipt.product,
    };

    res.json(responseData);
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's receipts
router.get('/user/all', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const userReceipts = await db.select({
      id: receipts.id,
      receiptNumber: receipts.receiptNumber,
      totalAmount: receipts.totalAmount,
      paymentMethod: receipts.paymentMethod,
      paymentStatus: receipts.paymentStatus,
      deliveryStatus: receipts.deliveryStatus,
      qrCodeImageUrl: receipts.qrCodeImageUrl,
      receiptPdfUrl: receipts.receiptPdfUrl,
      createdAt: receipts.createdAt,
      orderData: {
        id: orders.id,
        quantity: orders.quantity,
        status: orders.status,
      },
      productName: products.name,
    })
      .from(receipts)
      .leftJoin(orders, eq(receipts.orderId, orders.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(receipts.customerId, userId))
      .orderBy(desc(receipts.createdAt))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      receipts: userReceipts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        hasMore: userReceipts.length === Number(limit),
      },
    });
  } catch (error) {
    console.error('Get user receipts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Scan QR code for verification
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: 'QR code data is required' });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid QR code format' });
    }

    if (parsedData.type !== 'BRILLPRIME_RECEIPT') {
      return res.status(400).json({ error: 'Invalid QR code type' });
    }

    // Get receipt details
    const receiptData = await db.select({
      receipt: receipts,
      order: orders,
      product: {
        name: products.name,
        price: products.price,
      },
    })
      .from(receipts)
      .leftJoin(orders, eq(receipts.orderId, orders.id))
      .leftJoin(products, eq(orders.productId, products.id))
      .where(eq(receipts.receiptNumber, parsedData.receiptNumber));

    if (receiptData.length === 0) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const receiptInfo = receiptData[0];

    // Get customer and merchant details separately
    const [customerData, merchantData] = await Promise.all([
      db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      }).from(users).where(eq(users.id, receiptInfo.receipt.customerId)),
      
      db.select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
      }).from(users).where(eq(users.id, receiptInfo.receipt.merchantId)),
    ]);

    const receipt = {
      receipt: receiptInfo.receipt,
      customer: customerData[0] || null,
      merchant: merchantData[0] || null,
      order: receiptInfo.order,
      product: receiptInfo.product,
    };

    // Update verification status based on user role
    const updateData: any = { updatedAt: new Date() };
    
    if (userRole === 'MERCHANT' && receipt.receipt.merchantId === userId) {
      updateData.merchantVerifiedAt = new Date();
      updateData.merchantVerifiedBy = userId;
    } else if (userRole === 'DRIVER' && receipt.receipt.driverId === userId) {
      updateData.deliveryVerifiedAt = new Date();
      updateData.deliveryVerifiedBy = userId;
      updateData.deliveryStatus = 'DELIVERED';
    } else if (userRole === 'ADMIN') {
      updateData.adminVerifiedAt = new Date();
      updateData.adminVerifiedBy = userId;
    }

    // Update receipt if there are changes
    if (Object.keys(updateData).length > 1) {
      await db.update(receipts)
        .set(updateData)
        .where(eq(receipts.id, receipt.receipt.id));
    }

    res.json({
      message: 'QR code scanned successfully',
      receipt: {
        receiptNumber: receipt.receipt.receiptNumber,
        totalAmount: receipt.receipt.totalAmount,
        paymentStatus: receipt.receipt.paymentStatus,
        deliveryStatus: receipt.receipt.deliveryStatus,
        customer: receipt.customer,
        merchant: receipt.merchant,
        order: receipt.order,
        product: receipt.product,
        verificationInfo: {
          merchantVerified: !!receipt.receipt.merchantVerifiedAt,
          deliveryVerified: !!receipt.receipt.deliveryVerifiedAt,
          adminVerified: !!receipt.receipt.adminVerifiedAt,
        },
      },
      userAction: userRole === 'MERCHANT' ? 'MERCHANT_VERIFIED' : 
                 userRole === 'DRIVER' ? 'DELIVERY_VERIFIED' : 
                 userRole === 'ADMIN' ? 'ADMIN_VERIFIED' : 'VIEW_ONLY',
    });
  } catch (error) {
    console.error('Scan QR code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate PDF receipt function
async function generateReceiptPDF(filePath: string, data: any): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).text('BrillPrime Receipt', { align: 'center' });
      doc.moveDown();

      // Receipt details
      doc.fontSize(12);
      doc.text(`Receipt Number: ${data.receiptNumber}`, { align: 'left' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      // Customer details
      doc.text('Customer Information:', { underline: true });
      doc.text(`Name: ${data.orderData.customer?.fullName || 'N/A'}`);
      doc.text(`Email: ${data.orderData.customer?.email || 'N/A'}`);
      doc.text(`Phone: ${data.orderData.customer?.phone || 'N/A'}`);
      doc.moveDown();

      // Merchant details
      doc.text('Merchant Information:', { underline: true });
      doc.text(`Name: ${data.orderData.merchant?.fullName || 'N/A'}`);
      doc.text(`Email: ${data.orderData.merchant?.email || 'N/A'}`);
      doc.moveDown();

      // Order details
      doc.text('Order Information:', { underline: true });
      doc.text(`Product: ${data.orderData.product?.name || 'N/A'}`);
      doc.text(`Quantity: ${data.orderData.order.quantity}`);
      doc.text(`Unit Price: ₦${data.orderData.product?.price || '0'}`);
      doc.text(`Total Amount: ₦${data.orderData.order.totalPrice}`);
      doc.moveDown();

      // Payment details
      doc.text('Payment Information:', { underline: true });
      doc.text(`Payment Method: ${data.paymentMethod}`);
      if (data.transactionRef) {
        doc.text(`Transaction Reference: ${data.transactionRef}`);
      }
      doc.moveDown();

      // QR Code
      if (fs.existsSync(data.qrCodePath)) {
        doc.text('Scan QR Code for Verification:', { align: 'center' });
        doc.image(data.qrCodePath, {
          fit: [150, 150],
          align: 'center',
        });
      }

      // Footer
      doc.moveDown();
      doc.fontSize(10);
      doc.text('Thank you for using BrillPrime!', { align: 'center' });
      doc.text('This is a computer-generated receipt.', { align: 'center' });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

export default router;