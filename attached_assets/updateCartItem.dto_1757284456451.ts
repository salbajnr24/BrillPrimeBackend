import { IsString, IsNumber, IsPositive, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsString()
  cartItemId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;
}
