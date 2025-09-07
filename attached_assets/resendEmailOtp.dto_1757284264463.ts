import { IsEmail, IsString } from 'class-validator';

export class ResendEmailOtpDto {
  @IsString()
  @IsEmail()
  email: string;
}
