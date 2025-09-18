export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

export const validatePassword = (password: string): boolean => {
  return password.length >= 6; // Minimum 6 characters
};

export const validateRole = (role: string): boolean => {
  return ['CONSUMER', 'VENDOR', 'DRIVER', 'MERCHANT', 'ADMIN'].includes(role);
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+234|0)[789][01]\d{8}$/; // Nigerian phone format
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
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
    errors.push('Role must be one of: CONSUMER, VENDOR, DRIVER, MERCHANT');
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
    errors.push('Role must be one of: CONSUMER, VENDOR, DRIVER, MERCHANT');
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

  if (!data.productId || typeof data.productId !== 'string') {
    errors.push('Valid product ID is required');
  }

  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push('Quantity must be a positive number greater than 0');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateRemoveFromCart = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.productId || typeof data.productId !== 'string') {
    errors.push('Valid product ID is required');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateUpdateCartItem = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
    errors.push('Quantity must be a positive number greater than 0');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateAddCommodity = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!data.description || data.description.trim().length === 0) {
    errors.push('Product description is required');
  }

  if (!data.price || data.price <= 0) {
    errors.push('Valid price is required');
  }

  if (!data.unit || data.unit.trim().length === 0) {
    errors.push('Unit is required');
  }

  if (!data.quantity || data.quantity < 0) {
    errors.push('Valid quantity is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateUpdateCommodity = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.name !== undefined && data.name.trim().length === 0) {
    errors.push('Product name cannot be empty');
  }

  if (data.price !== undefined && data.price <= 0) {
    errors.push('Price must be greater than 0');
  }

  if (data.quantity !== undefined && data.quantity < 0) {
    errors.push('Quantity cannot be negative');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validatePlaceOrder = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.deliveryAddress || typeof data.deliveryAddress !== 'string' || data.deliveryAddress.trim().length === 0) {
    errors.push('Delivery address is required and must be a valid string');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateVerifyOrder = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.txRef || typeof data.txRef !== 'string') {
    errors.push('Transaction reference (txRef) is required');
  }

  if (!data.transactionId || typeof data.transactionId !== 'string') {
    errors.push('Transaction ID is required');
  }

  if (data.status !== undefined && typeof data.status !== 'string') {
    errors.push('Status must be a valid string if provided');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateConfirmOrder = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.txRef || typeof data.txRef !== 'string') {
    errors.push('Transaction reference (txRef) is required');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateOrderStatus = (status: string): boolean => {
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  return validStatuses.includes(status);
};

export const validateUpdateProfile = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.email !== undefined && !validateEmail(data.email)) {
    errors.push('Valid email is required if provided');
  }

  if (data.fullName !== undefined && (typeof data.fullName !== 'string' || data.fullName.trim().length < 2)) {
    errors.push('Full name must be at least 2 characters long if provided');
  }

  if (data.phone !== undefined && !validatePhone(data.phone)) {
    errors.push('Valid phone number is required if provided');
  }

  if (data.imageUrl !== undefined && typeof data.imageUrl !== 'string') {
    errors.push('Image URL must be a valid string if provided');
  }

  if (data.location !== undefined && typeof data.location !== 'string') {
    errors.push('Location must be a valid string if provided');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateCreateVendor = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.address || typeof data.address !== 'string' || data.address.trim().length === 0) {
    errors.push('Address is required and must be a valid string');
  }

  if (!data.businessName || typeof data.businessName !== 'string' || data.businessName.trim().length === 0) {
    errors.push('Business name is required and must be a valid string');
  }

  if (data.businessCategory !== undefined && typeof data.businessCategory !== 'string') {
    errors.push('Business category must be a valid string if provided');
  }

  if (data.businessNumber !== undefined && typeof data.businessNumber !== 'string') {
    errors.push('Business number must be a valid string if provided');
  }

  if (data.businessEmail !== undefined && (typeof data.businessEmail !== 'string' || !validateEmail(data.businessEmail))) {
    errors.push('Valid business email is required if provided');
  }

  if (!Array.isArray(data.openingHours)) {
    errors.push('Opening hours must be an array');
  } else {
    data.openingHours.forEach((hours: any, index: number) => {
      if (hours.dayOfWeek !== undefined && typeof hours.dayOfWeek !== 'string') {
        errors.push(`Opening hours[${index}]: Day of week must be a valid string if provided`);
      }
      if (hours.openTime !== undefined && typeof hours.openTime !== 'string') {
        errors.push(`Opening hours[${index}]: Open time must be a valid string if provided`);
      }
      if (hours.closeTime !== undefined && typeof hours.closeTime !== 'string') {
        errors.push(`Opening hours[${index}]: Close time must be a valid string if provided`);
      }
    });
  }

  return { isValid: errors.length === 0, errors };
};

export const validateUpdateVendor = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (data.address !== undefined && (typeof data.address !== 'string' || data.address.trim().length === 0)) {
    errors.push('Address must be a valid string if provided');
  }

  if (data.businessName !== undefined && (typeof data.businessName !== 'string' || data.businessName.trim().length === 0)) {
    errors.push('Business name must be a valid string if provided');
  }

  if (data.businessCategory !== undefined && typeof data.businessCategory !== 'string') {
    errors.push('Business category must be a valid string if provided');
  }

  if (data.businessNumber !== undefined && typeof data.businessNumber !== 'string') {
    errors.push('Business number must be a valid string if provided');
  }

  if (data.accountName !== undefined && typeof data.accountName !== 'string') {
    errors.push('Account name must be a valid string if provided');
  }

  if (data.bankName !== undefined && typeof data.bankName !== 'string') {
    errors.push('Bank name must be a valid string if provided');
  }

  if (data.accountNumber !== undefined && typeof data.accountNumber !== 'string') {
    errors.push('Account number must be a valid string if provided');
  }

  if (data.openingHours !== undefined) {
    if (!Array.isArray(data.openingHours)) {
      errors.push('Opening hours must be an array if provided');
    } else {
      data.openingHours.forEach((hours: any, index: number) => {
        if (hours.dayOfWeek !== undefined && typeof hours.dayOfWeek !== 'string') {
          errors.push(`Opening hours[${index}]: Day of week must be a valid string if provided`);
        }
        if (hours.openTime !== undefined && typeof hours.openTime !== 'string') {
          errors.push(`Opening hours[${index}]: Open time must be a valid string if provided`);
        }
        if (hours.closeTime !== undefined && typeof hours.closeTime !== 'string') {
          errors.push(`Opening hours[${index}]: Close time must be a valid string if provided`);
        }
      });
    }
  }

  return { isValid: errors.length === 0, errors };
};

export const validateAddBankDetails = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.accountName || typeof data.accountName !== 'string' || data.accountName.trim().length === 0) {
    errors.push('Account name is required and must be a valid string');
  }

  if (!data.bankName || typeof data.bankName !== 'string' || data.bankName.trim().length === 0) {
    errors.push('Bank name is required and must be a valid string');
  }

  if (!data.accountNumber || typeof data.accountNumber !== 'string' || data.accountNumber.trim().length === 0) {
    errors.push('Account number is required and must be a valid string');
  }

  if (!data.bankCode || typeof data.bankCode !== 'string' || data.bankCode.trim().length === 0) {
    errors.push('Bank code is required and must be a valid string');
  }

  return { isValid: errors.length === 0, errors };
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

export const validateImageUrl = (url: string): boolean => {
  const urlRegex = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i;
  return urlRegex.test(url);
};

export const validatePriceRange = (minPrice?: number, maxPrice?: number): boolean => {
  if (minPrice !== undefined && maxPrice !== undefined) {
    return minPrice <= maxPrice && minPrice >= 0;
  }
  return true;
};

export const validateId = (id: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!id) {
    errors.push('ID is required');
  } else if (typeof id !== 'string' && typeof id !== 'number') {
    errors.push('ID must be a string or number');
  }

  return { isValid: errors.length === 0, errors };
};

export const validatePagination = (page: any, limit: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (page !== undefined) {
    const pageNum = Number(page);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive number');
    }
  }

  if (limit !== undefined) {
    const limitNum = Number(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be between 1 and 100');
    }
  }

  return { isValid: errors.length === 0, errors };
};