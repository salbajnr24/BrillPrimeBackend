export interface PlaceOrderDto {
    deliveryAddress: string;
}
export interface VerifyOrderDto {
    txRef: string;
    transactionId: string;
    status?: string;
}
export interface ConfirmOrderDto {
    txRef: string;
}
export interface OrderDetails {
    id: string;
    buyerId: string;
    sellerId: string;
    productId: string;
    quantity: number;
    totalPrice: string;
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    deliveryAddress: string;
    createdAt: Date;
    updatedAt: Date;
}
