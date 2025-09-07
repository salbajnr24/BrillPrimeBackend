import { IsEmail, IsEnum, IsString } from 'class-validator';
import { Role } from 'src/common';

export class SignInDto {
  @IsEmail()
  @IsString()
  email: string;
  @IsString()
  password: string;

  @IsEnum(Role, { message: 'role must be one of the following: CONSUMER, VENDOR, DRIVER' })
  role: Role;
}
