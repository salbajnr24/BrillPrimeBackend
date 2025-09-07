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

export const validateAddToCart = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.commodityId || typeof data.commodityId !== 'string') {
    errors.push('Valid commodity ID is required');
  }

  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push('Quantity must be a positive number greater than 0');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateRemoveFromCart = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.commodityId || typeof data.commodityId !== 'string') {
    errors.push('Valid commodity ID is required');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateUpdateCartItem = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.cartItemId || typeof data.cartItemId !== 'string') {
    errors.push('Valid cart item ID is required');
  }

  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push('Quantity must be a positive number greater than 0');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateAddCommodity = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required and must be a valid string');
  }

  if (!data.price || typeof data.price !== 'string' || data.price.trim().length === 0) {
    errors.push('Price is required and must be a valid string');
  }

  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('Description is required and must be a valid string');
  }

  if (!data.unit || typeof data.unit !== 'string' || data.unit.trim().length === 0) {
    errors.push('Unit is required and must be a valid string');
  }

  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push('Quantity must be a positive number greater than 0');
  }

  if (data.imageUrl && typeof data.imageUrl !== 'string') {
    errors.push('Image URL must be a valid string if provided');
  }

  if (data.category && typeof data.category !== 'string') {
    errors.push('Category must be a valid string if provided');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateUpdateCommodity = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length === 0)) {
    errors.push('Name must be a valid string if provided');
  }

  if (data.price !== undefined && (typeof data.price !== 'string' || data.price.trim().length === 0)) {
    errors.push('Price must be a valid string if provided');
  }

  if (data.description !== undefined && (typeof data.description !== 'string' || data.description.trim().length === 0)) {
    errors.push('Description must be a valid string if provided');
  }

  if (data.quantity !== undefined && (typeof data.quantity !== 'number' || data.quantity < 1)) {
    errors.push('Quantity must be a positive number greater than 0 if provided');
  }

  if (data.imageUrl !== undefined && typeof data.imageUrl !== 'string') {
    errors.push('Image URL must be a valid string if provided');
  }

  if (data.category !== undefined && typeof data.category !== 'string') {
    errors.push('Category must be a valid string if provided');
  }

  return { isValid: errors.length === 0, errors };
};