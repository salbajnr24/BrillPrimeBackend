import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
// import { CreateOpeningHoursDto } from './create-opening-hours.dto';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  businessCategory?: string;

  @IsString()
  @IsOptional()
  businessNumber?: string;

  @IsString()
  @IsOptional()
  businessEmail?: string;

  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsArray()
  //   @ValidateNested({ each: true })
  @Type(() => CreateOpeningHoursDto)
  openingHours: CreateOpeningHoursDto[];
}

export class CreateOpeningHoursDto {
  @IsString()
  @IsOptional()
  dayOfWeek?: string;

  @IsString()
  @IsOptional()
  openTime?: string;

  @IsString()
  @IsOptional()
  closeTime?: string;
}
