import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  currentPassword: string;

  @IsNotEmpty()
  @MinLength(6, {
    message: 'New password must be at least 6 characters long',
  })
  newPassword: string;
}
