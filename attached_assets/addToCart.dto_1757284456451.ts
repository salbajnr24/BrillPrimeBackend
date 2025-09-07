import { IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class AddToCartDto {
  @IsString()
  commodityId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;
}
