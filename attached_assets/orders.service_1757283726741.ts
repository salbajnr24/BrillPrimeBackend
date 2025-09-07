// src/orders/orders.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from 'src/cart/cart.service';
import { VerifyOrderDto, VerifyOtpDto } from 'src/common/dto';
import { PaymentService } from 'src/payment/payment.service';
import { prisma } from 'src/prisma';
@Injectable()
export class OrdersService {
  constructor(
    private cartService: CartService,
    private readonly paymentService: PaymentService,
  ) {}

  async placeOrder(userId: string, email: string) {
    const cart = await this.cartService.getCart(userId);

    const totalPrice = cart.reduce((total, item) => {
      return total + parseFloat(item.commmodityPrice) * item.quantity;
    }, 0);

    console.log({ totalPrice });
    const vendorIds = cart.map((item) => item.vendorId);
    const cartId = cart.map((item) => item.cartId)[0];
    const uniqueVendorIds = [...new Set(vendorIds)];
    if (uniqueVendorIds.length > 1) {
      console.log('Multiple vendors detected:', uniqueVendorIds);
      throw new BadRequestException('Cannot place an order with items from multiple vendors.');
    }
    const order = await prisma.order.create({
      data: {
        consumerId: userId,
        totalPrice,
        status: 'PENDING',
        vendorId: uniqueVendorIds[0],
      },
    });

    await prisma.orderItem.createMany({
      data: cart.map((item) => ({
        orderId: order.id,
        cartId: item.cartId,
        commodityId: item.commodityId,
        quantity: item.quantity,
        commodityName: item.commodityName,
        commodityDescription: item.commodityDescription,
        commodityPrice: item.commmodityPrice,
        unit: item.unit,
        imageUrl: item.imageUrl,
        vendorId: item.vendorId,
      })),
    });

    const txRef = `order-${order.id}-${Date.now()}`;
    console.log({ txRef });
    await prisma.order.update({ where: { id: order.id }, data: { txRef } });

    const response = await this.paymentService.initializePayment(totalPrice, txRef, email);
    console.log(response);
    return response;
  }

  async finalizeOrder(txRef: string) {
    console.log('**********FINALIZED ORDER*****************');
    const txnRef = `order-${txRef}`;
    return await this.paymentService.finalizeOrder(txnRef);
  }

  // Get a specific order by ID
  async getOrderById(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const consumer = await prisma.user.findFirst({
      where: { id: order.consumerId },
      select: { id: true, fullName: true, imageUrl: true },
    });

    // const items = await this.cartService.getOrderCart(order.cartId);

    return { ...order, consumer };
    // return { order, items };
  }

  // Get all orders for a specific user
  async getConsumerOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { consumerId: userId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // orders.map(async (item) => {
    //   const commodity = await this.cartService.getCartCommodity(item.);

    // })
    return orders;
  }

  async getVendorOrders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { vendorId: userId, status: 'PAID' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch all consumer IDs from orders
    const consumerIds = orders.map((order) => order.consumerId);

    // Get consumer details in one query
    const consumers = await prisma.user.findMany({
      where: { id: { in: consumerIds } },
      select: { id: true, fullName: true, imageUrl: true },
    });

    // Create a mapping of consumerId -> consumer details
    const consumerMap = consumers.reduce(
      (acc, consumer) => {
        acc[consumer.id] = consumer;
        return acc;
      },
      {} as Record<string, { fullName: string; imageUrl: string | null }>,
    );

    // Attach consumer details to orders
    return orders.map((order) => ({
      consumerName: consumerMap[order.consumerId]?.fullName || null,
      consumerImage: consumerMap[order.consumerId]?.imageUrl || null,
      ...order,
    }));
  }

  // Cancel an order
  // async cancelOrder(orderId: string, userId: string) {
  //   const order = await prisma.order.findUnique({
  //     where: { id: orderId },
  //   });

  //   if (!order || order.consumerId !== userId) {
  //     throw new NotFoundException('Order not found');
  //   }

  //   if (order.status !== 'PENDING') {
  //     throw new BadRequestException('Only pending orders can be canceled');
  //   }

  //   await prisma.order.update({
  //     where: { id: orderId },
  //     data: { status: 'CANCELLED' },
  //   });

  //   return { message: 'Order canceled successfully' };
  // }

  // Update order status (e.g., mark as paid or complete)
  async updateOrderStatus(userId: string, payload: VerifyOrderDto) {
    const order = await prisma.order.findFirst({
      where: { consumerId: userId, txRef: payload.txRef },
    });
    console.log({ order });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const isVerified = await this.paymentService.verifyPayment(payload.transactionId);
    if (isVerified === 'successful') {
      const data = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PAID', transactionId: payload.transactionId },
      });

      const cart = await this.cartService.getCart(order.consumerId);

      await this.cartService.clearCart(cart[0].cartId);

      return { message: 'Order verified successfully', status: 'PAID', data };
    } else if (payload.status != 'successful') {
      const data = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });
      return { message: 'Order verification failed', status: 'FAILED', data };
    } else {
      const data = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'PENDING' },
      });
      return { message: 'Order verification pending', status: 'PENDING', data };
    }
  }

  // Clear the cart
  private async clearCart(cartId: string) {
    await prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }
}
