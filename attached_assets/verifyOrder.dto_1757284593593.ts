import { IsOptional, IsString } from 'class-validator';

export class VerifyOrderDto {
  @IsString()
  txRef: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  @IsString()
  status: string;
}
