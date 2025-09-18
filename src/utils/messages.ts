
export enum Message {
  signUp = 'User Sign Up Successful. Verification token sent.',
  signIn = 'User Sign in successful',
  otpSent = 'Otp sent successfully',
  verifyOtp = 'OTP verification successful',
  forgotPassword = 'Password reset token sent successfully',
  resetPassword = 'Password reset successful',
  changePassword = 'Password change successful',
  userProfile = 'User profile fetched successfully',
  addCommodity = 'Commodity added successfully',
  updateCommodity = 'Commodity updated successfully',
  unauthorizedCommodityVendor = 'Only vendor that Added the product can update',
  commodityNotFound = 'Commodity not found',
  getVendorCommodities = 'Vendor commodities fetched',
  getCommodities = 'Commodities fetched successfully',
  removeCommodity = 'Commodity deleted',
  addToCart = 'Item added to cart',
  getCart = 'Cart items fetched successfully',
  removeFromCart = 'Cart item removed successfully',
  updateCartItemQuantity = 'Cart item quantity updated',
  placeOrder = 'Order placed successfully',
  fetchOrder = 'Order fetched successfully',
  passwordResetVerified = 'Password reset verified successfully',
  vendorOnboarded = 'Vendor onboarded successfully',
  vendorDetails = 'Vendor details added successfully',
  vendorUpdated = 'Vendor updated successfully',
  vendorFetched = 'Vendors fetched successfully',
  profileUpdate = 'Profile updated successfully',
  categoriesFetched = 'Categories fetched successfully',
  
  // Search functionality messages
  searchAutocomplete = 'Search suggestions fetched successfully',
  advancedSearch = 'Advanced search results fetched successfully',
  trendingSearch = 'Trending searches fetched successfully',
  saveSearch = 'Search criteria saved successfully',
  
  // Reviews functionality messages
  reviewsPending = 'Pending reviews fetched successfully',
  reviewResponse = 'Review response submitted successfully',
  reviewAnalytics = 'Review analytics fetched successfully',
  reviewModeration = 'Review moderation completed successfully',
  reviewSubmitted = 'Review submitted successfully',
  
  // Geolocation functionality messages
  nearbyServices = 'Nearby services fetched successfully',
  routeOptimized = 'Route optimization completed successfully',
  serviceAreasChecked = 'Service areas availability checked successfully',
  deliveryEstimate = 'Delivery time estimated successfully',
  
  // Notifications functionality messages
  notificationPreferencesUpdated = 'Notification preferences updated successfully',
  batchNotificationsSent = 'Batch notifications sent successfully',
  notificationTemplatesFetched = 'Notification templates fetched successfully',
  notificationScheduled = 'Notification scheduled successfully',
  notificationsFetched = 'Notifications fetched successfully',
  notificationMarkedRead = 'Notification marked as read successfully',
  notificationDeleted = 'Notification deleted successfully',
  
  // Order management messages
  orderStatusUpdated = 'Order status updated successfully',
  orderCancelled = 'Order cancelled successfully',
  orderRefunded = 'Order refunded successfully',
  orderConfirmed = 'Order confirmed successfully',
  
  // Receipt and payment messages
  receiptGenerated = 'Receipt generated successfully',
  paymentInitialized = 'Payment initialized successfully',
  paymentVerified = 'Payment verified successfully',
  paymentFailed = 'Payment failed',
  
  // Category and business management messages
  businessCategoryCreated = 'Business category created successfully',
  commodityCategoryCreated = 'Commodity category created successfully',
  openingHoursUpdated = 'Opening hours updated successfully',
  
  // Location and profile messages
  locationUpdated = 'Location updated successfully',
  roleSwitched = 'Role switched successfully',
  merchantProfileUpdated = 'Merchant profile updated successfully',
  driverProfileUpdated = 'Driver profile updated successfully',
  
  // Reporting and moderation messages
  userReported = 'User reported successfully',
  productReported = 'Product reported successfully',
  contentModerated = 'Content moderation completed successfully',
  
  // Security and MFA messages
  mfaSetup = 'MFA setup completed successfully',
  mfaVerified = 'MFA verification successful',
  mfaDisabled = 'MFA disabled successfully',
  backupCodesGenerated = 'Backup codes generated successfully',
  
  // Delivery and logistics messages
  deliveryRequestCreated = 'Delivery request created successfully',
  deliveryAccepted = 'Delivery request accepted successfully',
  deliveryStatusUpdated = 'Delivery status updated successfully',
  
  // Fuel and toll messages
  fuelOrderPlaced = 'Fuel order placed successfully',
  tollPaymentCompleted = 'Toll payment completed successfully',
  
  // Wallet and QR payments messages
  walletFunded = 'Wallet funded successfully',
  qrCodeGenerated = 'QR code generated successfully',
  qrPaymentCompleted = 'QR payment completed successfully',
  
  // Support and tickets messages
  supportTicketCreated = 'Support ticket created successfully',
  ticketUpdated = 'Support ticket updated successfully',
  ticketResolved = 'Support ticket resolved successfully',
  
  // Chat and messaging messages
  conversationStarted = 'Conversation started successfully',
  messageSent = 'Message sent successfully',
  
  // Analytics and reporting messages
  analyticsGenerated = 'Analytics data generated successfully',
  reportGenerated = 'Report generated successfully',
  
  // Admin and system messages
  userVerified = 'User verification completed successfully',
  systemHealthy = 'System is healthy and operational',
  dataExported = 'Data exported successfully',
  backupCompleted = 'System backup completed successfully',
  
  // Generic success and error messages
  operationSuccessful = 'Operation completed successfully',
  dataFetched = 'Data fetched successfully',
  dataUpdated = 'Data updated successfully',
  dataDeleted = 'Data deleted successfully',
  accessDenied = 'Access denied',
  resourceNotFound = 'Resource not found',
  validationFailed = 'Validation failed',
  internalError = 'Internal server error occurred',
}
