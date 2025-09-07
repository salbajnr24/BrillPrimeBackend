import { IsNotEmpty, IsEmail, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty()
  @MinLength(6, {
    message: 'New password must be at least 6 characters long',
  })
  password: string;
}
