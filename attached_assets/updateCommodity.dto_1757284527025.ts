import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
export class UpdateCommodityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity?: number; // Optional field

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
