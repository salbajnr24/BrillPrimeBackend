import { IsInt, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class AddCommodityDto {
  @IsString()
  name: string;

  @IsString()
  price: string;

  @IsString()
  imageUrl: string;

  @IsString()
  description: string;

  @IsString()
  unit: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;

  @IsString()
  category?: string;
  //   vendorId: string;
}
