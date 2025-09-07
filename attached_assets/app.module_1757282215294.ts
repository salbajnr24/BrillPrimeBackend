import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CommoditiesModule } from './commodities/commodities.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mailer/mailer.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    AuthModule,
    CommoditiesModule,
    OrdersModule,
    CartModule,
    UsersModule,
    MailModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
