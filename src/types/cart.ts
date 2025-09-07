
export interface AddToCartDto {
  commodityId: string;
  quantity: number;
}

export interface RemoveFromCartDto {
  commodityId: string;
}

export interface UpdateCartItemDto {
  cartItemId: string;
  quantity: number;
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}
