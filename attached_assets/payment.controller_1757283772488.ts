import { Controller, Post, Body, Req, Res, Query, Get } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly payment: PaymentService) {}

  // Callback endpoint: User is redirected here after payment
  @Get('callback')
  async handleCallback(@Query('transaction_id') transactionId: string) {
    try {
      const data = await this.payment.verifyPayment(transactionId);
      console.log(data);
      //   return res.redirect(`${process.env.APP_URL}/order/success`);
    } catch (error) {
      console.log(error);
      //   return res.redirect(`${process.env.APP_URL}/order/failure`);
    }
  }

  // Webhook endpoint: Flutterwave notifies your server of a transaction
  @Post('webhook')
  async handleWebhook(@Body() body) {
    const { txRef, status } = body.data;

    // Flutterwave retries notifications, so ensure idempotency
    if (status === 'successful') {
      //   await this.orderService.finalizeOrder(txRef);
    }
  }

  @Get('banks')
  async getBankList(@Query('search') search?: string) {
    return this.payment.getBankList(search);
  }

  @Post('verify-account')
  async verifyAccount(@Body() body: { accountNumber: string; bankCode: string }) {
    return this.payment.verifyAccount(body.accountNumber, body.bankCode);
  }
}
