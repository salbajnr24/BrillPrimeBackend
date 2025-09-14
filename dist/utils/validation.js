"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAddBankDetails = exports.validateUpdateVendor = exports.validateCreateVendor = exports.validateUpdateProfile = exports.validateOrderStatus = exports.validateConfirmOrder = exports.validateVerifyOrder = exports.validatePlaceOrder = exports.validateUpdateCommodity = exports.validateAddCommodity = exports.validateUpdateCartItem = exports.validateRemoveFromCart = exports.validateAddToCart = exports.validateForgotPassword = exports.validateVerifyOtp = exports.validateResetPassword = exports.validateChangePassword = exports.validateSignIn = exports.validateSignUp = exports.validatePhone = exports.validateRole = exports.validatePassword = exports.validateEmail = void 0;
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
const validatePassword = (password) => {
    return password.length >= 6;
};
exports.validatePassword = validatePassword;
const validateRole = (role) => {
    return ['CONSUMER', 'VENDOR', 'DRIVER', 'MERCHANT'].includes(role);
};
exports.validateRole = validateRole;
const validatePhone = (phone) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.length >= 10;
};
exports.validatePhone = validatePhone;
const validateSignUp = (data) => {
    const errors = [];
    if (!data.email || !(0, exports.validateEmail)(data.email)) {
        errors.push('Valid email is required');
    }
    if (!data.fullName || data.fullName.trim().length < 2) {
        errors.push('Full name must be at least 2 characters long');
    }
    if (!data.password || !(0, exports.validatePassword)(data.password)) {
        errors.push('Password must be at least 6 characters long');
    }
    if (!data.phone || !(0, exports.validatePhone)(data.phone)) {
        errors.push('Valid phone number is required');
    }
    if (!data.role || !(0, exports.validateRole)(data.role)) {
        errors.push('Role must be one of: CONSUMER, VENDOR, DRIVER, MERCHANT');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateSignUp = validateSignUp;
const validateSignIn = (data) => {
    const errors = [];
    if (!data.email || !(0, exports.validateEmail)(data.email)) {
        errors.push('Valid email is required');
    }
    if (!data.password) {
        errors.push('Password is required');
    }
    if (!data.role || !(0, exports.validateRole)(data.role)) {
        errors.push('Role must be one of: CONSUMER, VENDOR, DRIVER, MERCHANT');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateSignIn = validateSignIn;
const validateChangePassword = (data) => {
    const errors = [];
    if (!data.currentPassword) {
        errors.push('Current password is required');
    }
    if (!data.newPassword || !(0, exports.validatePassword)(data.newPassword)) {
        errors.push('New password must be at least 6 characters long');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateChangePassword = validateChangePassword;
const validateResetPassword = (data) => {
    const errors = [];
    if (!data.password || !(0, exports.validatePassword)(data.password)) {
        errors.push('Password must be at least 6 characters long');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateResetPassword = validateResetPassword;
const validateVerifyOtp = (data) => {
    const errors = [];
    if (!data.email || !(0, exports.validateEmail)(data.email)) {
        errors.push('Valid email is required');
    }
    if (!data.otp || data.otp.length !== 6) {
        errors.push('OTP must be 6 digits');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateVerifyOtp = validateVerifyOtp;
const validateForgotPassword = (data) => {
    const errors = [];
    if (!data.email || !(0, exports.validateEmail)(data.email)) {
        errors.push('Valid email is required');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateForgotPassword = validateForgotPassword;
const validateAddToCart = (data) => {
    const errors = [];
    if (!data.commodityId || typeof data.commodityId !== 'string') {
        errors.push('Valid commodity ID is required');
    }
    if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
        errors.push('Quantity must be a positive number greater than 0');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateAddToCart = validateAddToCart;
const validateRemoveFromCart = (data) => {
    const errors = [];
    if (!data.commodityId || typeof data.commodityId !== 'string') {
        errors.push('Valid commodity ID is required');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateRemoveFromCart = validateRemoveFromCart;
const validateUpdateCartItem = (data) => {
    const errors = [];
    if (!data.cartItemId || typeof data.cartItemId !== 'string') {
        errors.push('Valid cart item ID is required');
    }
    if (!data.quantity || typeof data.quantity !== 'number' || data.quantity < 1) {
        errors.push('Quantity must be a positive number greater than 0');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateUpdateCartItem = validateUpdateCartItem;
const validateAddCommodity = (data) => {
    const errors = [];
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
exports.validateAddCommodity = validateAddCommodity;
const validateUpdateCommodity = (data) => {
    const errors = [];
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
exports.validateUpdateCommodity = validateUpdateCommodity;
const validatePlaceOrder = (data) => {
    const errors = [];
    if (!data.deliveryAddress || typeof data.deliveryAddress !== 'string' || data.deliveryAddress.trim().length === 0) {
        errors.push('Delivery address is required and must be a valid string');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validatePlaceOrder = validatePlaceOrder;
const validateVerifyOrder = (data) => {
    const errors = [];
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
exports.validateVerifyOrder = validateVerifyOrder;
const validateConfirmOrder = (data) => {
    const errors = [];
    if (!data.txRef || typeof data.txRef !== 'string') {
        errors.push('Transaction reference (txRef) is required');
    }
    return { isValid: errors.length === 0, errors };
};
exports.validateConfirmOrder = validateConfirmOrder;
const validateOrderStatus = (status) => {
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    return validStatuses.includes(status);
};
exports.validateOrderStatus = validateOrderStatus;
const validateUpdateProfile = (data) => {
    const errors = [];
    if (data.email !== undefined && !(0, exports.validateEmail)(data.email)) {
        errors.push('Valid email is required if provided');
    }
    if (data.fullName !== undefined && (typeof data.fullName !== 'string' || data.fullName.trim().length < 2)) {
        errors.push('Full name must be at least 2 characters long if provided');
    }
    if (data.phone !== undefined && !(0, exports.validatePhone)(data.phone)) {
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
exports.validateUpdateProfile = validateUpdateProfile;
const validateCreateVendor = (data) => {
    const errors = [];
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
    if (data.businessEmail !== undefined && (typeof data.businessEmail !== 'string' || !(0, exports.validateEmail)(data.businessEmail))) {
        errors.push('Valid business email is required if provided');
    }
    if (!Array.isArray(data.openingHours)) {
        errors.push('Opening hours must be an array');
    }
    else {
        data.openingHours.forEach((hours, index) => {
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
exports.validateCreateVendor = validateCreateVendor;
const validateUpdateVendor = (data) => {
    const errors = [];
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
        }
        else {
            data.openingHours.forEach((hours, index) => {
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
exports.validateUpdateVendor = validateUpdateVendor;
const validateAddBankDetails = (data) => {
    const errors = [];
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
exports.validateAddBankDetails = validateAddBankDetails;
