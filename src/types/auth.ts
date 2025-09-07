
export enum Role {
  CONSUMER = 'CONSUMER',
  VENDOR = 'VENDOR',
  DRIVER = 'DRIVER',
}

// Keep MERCHANT as alias for backward compatibility
export type UserRole = 'CONSUMER' | 'MERCHANT' | 'DRIVER' | 'VENDOR';

export interface SignUpDto {
  email: string;
  fullName: string;
  password: string;
  phone: string;
  role: UserRole;
}

export interface SignInDto {
  email: string;
  password: string;
  role: UserRole;
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
  role?: UserRole;
}

export interface UpdateProfileDto {
  email?: string;
  fullName?: string;
  imageUrl?: string;
  phone?: string;
  location?: string;
}

export interface CreateVendorDto {
  address: string;
  businessCategory?: string;
  businessNumber?: string;
  businessEmail?: string;
  businessName: string;
  openingHours: CreateOpeningHoursDto[];
}

export interface CreateOpeningHoursDto {
  dayOfWeek?: string;
  openTime?: string;
  closeTime?: string;
}

export interface UpdateVendorDto {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  address?: string;
  businessCategory?: string;
  businessNumber?: string;
  businessName?: string;
  openingHours?: EditOpeningHoursDto[];
}

export interface EditOpeningHoursDto {
  dayOfWeek?: string;
  openTime?: string;
  closeTime?: string;
}

export interface AddBankDetailsDto {
  accountName: string;
  bankName: string;
  accountNumber: string;
  bankCode: string;
}
