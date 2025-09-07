import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartService } from 'src/cart/cart.service';
import { PaymentService } from 'src/payment/payment.service';

@Module({
  providers: [OrdersService, CartService, PaymentService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
