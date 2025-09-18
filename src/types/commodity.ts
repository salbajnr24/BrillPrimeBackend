
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
export interface AddCommodityDto {
  name: string;
  description: string;
  price: number;
  unit: string;
  quantity: number;
  imageUrl?: string;
  categoryId?: number;
}

export interface UpdateCommodityDto {
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
  quantity?: number;
  imageUrl?: string;
  inStock?: boolean;
}

export interface CommodityResponse {
  id: number;
  name: string;
  description: string;
  price: string;
  unit: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  minimumOrder: number;
  createdAt: Date;
  category?: {
    id: number;
    name: string;
    icon: string;
  };
  vendor?: {
    id: number;
    fullName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  };
}

export interface CommodityFilters {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  vendorId?: number;
  sortBy?: 'name' | 'price' | 'rating' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
