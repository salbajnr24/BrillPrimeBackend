
export interface SignUpDto {
  email: string;
  fullName: string;
  password: string;
  phone: string;
  role: 'CONSUMER' | 'MERCHANT' | 'DRIVER';
}

export interface SignInDto {
  email: string;
  password: string;
  role: 'CONSUMER' | 'MERCHANT' | 'DRIVER';
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  password: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
}

export interface ResendEmailOtpDto {
  email: string;
}

export interface UpdateUserDto {
  fullName?: string;
  password?: string;
  phone?: string;
  role?: 'CONSUMER' | 'MERCHANT' | 'DRIVER';
}
