// src/orders/orders.controller.ts
import { Controller, Post, Get, Patch, Delete, Param, Body, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard, Roles, RolesGuard } from 'src/config';
import { Message } from 'src/common/utils';
import { Role } from 'src/common';
import { ConfirmOrderDto, VerifyOrderDto } from 'src/common/dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.CONSUMER)
  @Post('place')
  async placeOrder(@Request() req) {
    const { userId, email } = req.user;
    const data = await this.ordersService.placeOrder(userId, email);

    return {
      status: 'Success',
      message: Message.placeOrder,
      data: data,
    };
  }

  @Get('/consumer-orders')
  async getOrdersByUser(@Request() req) {
    const userId = req.user['userId'];
    const data = await this.ordersService.getConsumerOrders(userId);
    return {
      status: 'Success',
      message: Message.fetchOrder,
      data: data,
    };
  }

  @Roles(Role.VENDOR)
  @Get('vendor-orders')
  async getVendorOrders(@Request() req) {
    // return req.user;
    const userId = req.user['userId'];
    const data = await this.ordersService.getVendorOrders(userId);
    return {
      status: 'Success',
      message: Message.fetchOrder,
      data: data,
    };
  }

  @Get('/:orderId')
  async getOrderById(@Request() req, @Param('orderId') orderId: string) {
    const userId = req.user['userId'];
    const data = await this.ordersService.getOrderById(orderId, userId);
    return {
      status: 'Success',
      message: Message.fetchOrder,
      data: data,
    };
  }

  // @Patch('cancel/:orderId')
  // async cancelOrder(@Request() req, @Param('orderId') orderId: string) {
  //   const userId = req.user['id'];
  //   return this.ordersService.cancelOrder(orderId, userId);
  // }

  @Patch('verify-order')
  async updateOrderStatus(@Request() req, @Body() payload: VerifyOrderDto) {
    const userId = req.user['userId'];
    return this.ordersService.updateOrderStatus(userId, payload);
  }

  @Roles(Role.VENDOR)
  @Post('confirm-order')
  async finalizeOrder(@Body() payload: ConfirmOrderDto) {
    return await this.ordersService.finalizeOrder(payload.txRef);
  }
}
