import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { CartService } from 'src/cart/cart.service';
import { OrdersService } from 'src/orders/orders.service';
import { prisma } from 'src/prisma';

@Injectable()
export class PaymentService {
  constructor(private cartService: CartService) {}
  private readonly flutterwaveBaseUrl = process.env.FLW_BASE_URL;
  private readonly secretKey = process.env.FLW_SECRET_KEY;

  async initializePayment(amount: number, txRef: string, customerEmail: string, currency: string = 'NGN') {
    try {
      const response = await axios.post(
        `${this.flutterwaveBaseUrl}/payments`,
        {
          tx_ref: txRef,
          amount,
          currency,
          redirect_url: `${process.env.BASE_URL}payment/callback`,
          customer: {
            email: customerEmail,
          },
          customizations: {
            title: 'Brillprime',
            description: 'Order Payment',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log(`payment service response ${response.data}`);
      return response.data.data.link; // Return the payment link
    } catch (error) {
      throw new HttpException('Payment initialization failed', HttpStatus.BAD_REQUEST);
    }
  }

  async settleVendorPayment(orderId: string) {
    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new HttpException('Order not found', HttpStatus.NOT_FOUND);
      }
      if (order.status !== 'PAID') {
        throw new HttpException('Order has not been paid', HttpStatus.BAD_REQUEST);
      }

      const vendor = await prisma.vendor.findFirst({ where: { id: order.vendorId } });

      if (!vendor.accountNumber || !vendor.bankName) {
        throw new HttpException('Vendor bank details are missing', HttpStatus.BAD_REQUEST);
      }

      // Flutterwave payout API
      const response = await axios.post(
        'https://api.flutterwave.com/v3/transfers',
        {
          account_bank: vendor.bankName, // Bank code (get from Flutterwave bank list)
          account_number: vendor.accountNumber,
          amount: order.totalPrice,
          narration: `Payout for Order ${orderId}`,
          currency: 'NGN',
          reference: `PAYOUT-${new Date()}`, // Unique payout reference
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.status === 'success') {
        // Update order status to "SETTLED"
        await prisma.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETE' },
        });

        return {
          message: 'Payment successfully settled to vendor',
          transferId: response.data.data.id,
        };
      } else {
        throw new HttpException('Payout failed', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      throw new HttpException('Payout error: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyPayment(transactionId: string) {
    console.log({ transactionId });
    try {
      const response = await axios.get(`${this.flutterwaveBaseUrl}/transactions/${transactionId}/verify`, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      console.log(response.data);
      return response.data.data.status;
    } catch (error) {
      console.log(error);
      throw new BadRequestException('Failed to verify payment, please contact support');
    }
  }

  async finalizeOrder(txRef: string) {
    console.log('**********FINALIZED ORDER*****************');
    const existingOrder = await prisma.order.findUnique({
      where: { txRef },
    });

    let isPaymentValid;
    if (existingOrder && existingOrder.status === 'PAID') {
      isPaymentValid = true;
    } else {
      isPaymentValid = false;
    }

    if (!isPaymentValid) {
      throw new BadRequestException('Failed to confirm order');
    }

    const order = await prisma.order.update({ where: { txRef }, data: { status: 'COMPLETE' } });
    // const settled = await this.settleVendorPayment(existingOrder.id);

    return order;
  }

  async getBankList(search?: string) {
    try {
      const response = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      if (response.data.status !== 'success') {
        throw new HttpException('Failed to fetch bank list', HttpStatus.BAD_REQUEST);
      }

      let banks = response.data.data;

      // Apply search filter if provided
      if (search) {
        const lowerSearch = search.toLowerCase();
        banks = banks.filter(
          (bank: any) => bank.name.toLowerCase().includes(lowerSearch) || bank.code.includes(search),
        );
      }

      return banks;
    } catch (error) {
      throw new HttpException('Error fetching banks: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async verifyAccount(accountNumber: string, bankCode: string) {
    try {
      const response = await axios.post(
        'https://api.flutterwave.com/v3/accounts/resolve',
        {
          account_number: accountNumber,
          account_bank: bankCode,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.status !== 'success') {
        throw new HttpException('Failed to verify account', HttpStatus.BAD_REQUEST);
      }

      return response.data.data; // Returns { account_number, account_name, account_bank }
    } catch (error) {
      throw new HttpException('Error verifying account: ' + error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
