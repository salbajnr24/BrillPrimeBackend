export declare const validateEmail: (email: string) => boolean;
export declare const validatePassword: (password: string) => boolean;
export declare const validateRole: (role: string) => boolean;
export declare const validatePhone: (phone: string) => boolean;
export declare const validateSignUp: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateSignIn: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateChangePassword: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateResetPassword: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateVerifyOtp: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateForgotPassword: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateAddToCart: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateRemoveFromCart: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateUpdateCartItem: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateAddCommodity: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateUpdateCommodity: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validatePlaceOrder: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateVerifyOrder: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateConfirmOrder: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateOrderStatus: (status: string) => boolean;
export declare const validateUpdateProfile: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateCreateVendor: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateUpdateVendor: (data: any) => {
    isValid: boolean;
    errors: string[];
};
export declare const validateAddBankDetails: (data: any) => {
    isValid: boolean;
    errors: string[];
};
