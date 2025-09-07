import { IsEmail, IsEnum, IsString } from 'class-validator';
import { Role } from 'src/common/roles.enum';

export class SignUpDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  fullName: string;

  @IsString()
  password: string;

  @IsString()
  phone: string;

  @IsEnum(Role, { message: 'role must be one of the following: CONSUMER, VENDOR, DRIVER' })
  role: Role;
}
