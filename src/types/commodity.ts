
export interface AddCommodityDto {
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  unit: string;
  quantity: number;
  category?: string;
}

export interface UpdateCommodityDto {
  name?: string;
  price?: string;
  quantity?: number;
  description?: string;
  imageUrl?: string;
  category?: string;
}

export interface Commodity {
  id: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  image: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  minimumOrder: number;
  categoryId: string;
  sellerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
