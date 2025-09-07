
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6;
};

export const validateRole = (role: string): boolean => {
  return ['CONSUMER', 'MERCHANT', 'DRIVER'].includes(role);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.length >= 10;
};

export const validateSignUp = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.fullName || data.fullName.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long');
  }

  if (!data.password || !validatePassword(data.password)) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!data.phone || !validatePhone(data.phone)) {
    errors.push('Valid phone number is required');
  }

  if (!data.role || !validateRole(data.role)) {
    errors.push('Role must be one of: CONSUMER, MERCHANT, DRIVER');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateSignIn = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.password) {
    errors.push('Password is required');
  }

  if (!data.role || !validateRole(data.role)) {
    errors.push('Role must be one of: CONSUMER, MERCHANT, DRIVER');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateChangePassword = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.currentPassword) {
    errors.push('Current password is required');
  }

  if (!data.newPassword || !validatePassword(data.newPassword)) {
    errors.push('New password must be at least 6 characters long');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateResetPassword = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.password || !validatePassword(data.password)) {
    errors.push('Password must be at least 6 characters long');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateVerifyOtp = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.otp || data.otp.length !== 6) {
    errors.push('OTP must be 6 digits');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateForgotPassword = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.email || !validateEmail(data.email)) {
    errors.push('Valid email is required');
  }

  return { isValid: errors.length === 0, errors };
};
