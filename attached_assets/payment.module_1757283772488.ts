import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CartService } from 'src/cart/cart.service';

@Module({
  controllers: [PaymentController],
  // providers: [PaymentService, OrdersService],
  providers: [PaymentService, CartService],
})
export class PaymentModule {}
