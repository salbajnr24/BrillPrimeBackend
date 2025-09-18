
import { messageQueue, JobTypes } from './messageQueue';

interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

interface NotificationTarget {
  userId?: string;
  userIds?: string[];
  deviceToken?: string;
  deviceTokens?: string[];
  topic?: string;
  condition?: string;
}

interface NotificationOptions {
  priority?: 'normal' | 'high';
  ttl?: number;
  collapseKey?: string;
  dryRun?: boolean;
}

class PushNotificationService {
  private subscribers: Map<string, Set<string>> = new Map(); // userId -> Set of device tokens
  private topicSubscribers: Map<string, Set<string>> = new Map(); // topic -> Set of device tokens

  constructor() {
    // Register message queue handler
    messageQueue.registerHandler(JobTypes.SEND_NOTIFICATION, this.processNotification.bind(this));
  }

  async send(
    target: NotificationTarget,
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    const jobId = await messageQueue.add(JobTypes.SEND_NOTIFICATION, {
      target,
      notification,
      options
    }, {
      priority: options.priority === 'high' ? 10 : 0
    });

    return jobId;
  }

  async sendToUser(
    userId: string,
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    return this.send({ userId }, notification, options);
  }

  async sendToUsers(
    userIds: string[],
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    return this.send({ userIds }, notification, options);
  }

  async sendToTopic(
    topic: string,
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    return this.send({ topic }, notification, options);
  }

  async sendToDevice(
    deviceToken: string,
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    return this.send({ deviceToken }, notification, options);
  }

  async sendToDevices(
    deviceTokens: string[],
    notification: PushNotificationData,
    options: NotificationOptions = {}
  ): Promise<string> {
    return this.send({ deviceTokens }, notification, options);
  }

  // Device token management
  async registerDevice(userId: string, deviceToken: string): Promise<void> {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(deviceToken);
  }

  async unregisterDevice(userId: string, deviceToken: string): Promise<void> {
    const userTokens = this.subscribers.get(userId);
    if (userTokens) {
      userTokens.delete(deviceToken);
      if (userTokens.size === 0) {
        this.subscribers.delete(userId);
      }
    }
  }

  // Topic subscription management
  async subscribeToTopic(deviceToken: string, topic: string): Promise<void> {
    if (!this.topicSubscribers.has(topic)) {
      this.topicSubscribers.set(topic, new Set());
    }
    this.topicSubscribers.get(topic)!.add(deviceToken);
  }

  async unsubscribeFromTopic(deviceToken: string, topic: string): Promise<void> {
    const topicTokens = this.topicSubscribers.get(topic);
    if (topicTokens) {
      topicTokens.delete(deviceToken);
      if (topicTokens.size === 0) {
        this.topicSubscribers.delete(topic);
      }
    }
  }

  private async processNotification(job: any): Promise<void> {
    const { target, notification, options } = job.data;

    try {
      const deviceTokens = await this.resolveDeviceTokens(target);
      
      if (deviceTokens.length === 0) {
        console.warn('No device tokens found for notification target');
        return;
      }

      // In a real implementation, you would integrate with FCM, APNs, etc.
      // For now, we'll simulate sending notifications
      await this.simulateSendNotification(deviceTokens, notification, options);

      console.log(`Notification sent to ${deviceTokens.length} devices:`, {
        title: notification.title,
        body: notification.body
      });
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw error;
    }
  }

  private async resolveDeviceTokens(target: NotificationTarget): Promise<string[]> {
    const tokens: Set<string> = new Set();

    if (target.deviceToken) {
      tokens.add(target.deviceToken);
    }

    if (target.deviceTokens) {
      target.deviceTokens.forEach(token => tokens.add(token));
    }

    if (target.userId) {
      const userTokens = this.subscribers.get(target.userId);
      if (userTokens) {
        userTokens.forEach(token => tokens.add(token));
      }
    }

    if (target.userIds) {
      for (const userId of target.userIds) {
        const userTokens = this.subscribers.get(userId);
        if (userTokens) {
          userTokens.forEach(token => tokens.add(token));
        }
      }
    }

    if (target.topic) {
      const topicTokens = this.topicSubscribers.get(target.topic);
      if (topicTokens) {
        topicTokens.forEach(token => tokens.add(token));
      }
    }

    return Array.from(tokens);
  }

  private async simulateSendNotification(
    deviceTokens: string[],
    notification: PushNotificationData,
    options: NotificationOptions
  ): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, you would:
    // 1. Use FCM SDK for Android notifications
    // 2. Use APNs for iOS notifications
    // 3. Use Web Push for browser notifications
    // 4. Handle errors and retry logic
    // 5. Track delivery status

    const payload = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        image: notification.image
      },
      data: notification.data || {},
      options: {
        priority: options.priority || 'normal',
        timeToLive: options.ttl || 2419200, // 4 weeks default
        collapseKey: options.collapseKey
      }
    };

    // Log for debugging (remove in production)
    console.log('Push notification payload:', payload);
    console.log('Target device tokens:', deviceTokens.length);
  }

  // Analytics and monitoring
  getStats() {
    return {
      totalSubscribers: this.subscribers.size,
      totalDeviceTokens: Array.from(this.subscribers.values())
        .reduce((total, tokens) => total + tokens.size, 0),
      totalTopics: this.topicSubscribers.size,
      topicSubscriptions: Array.from(this.topicSubscribers.values())
        .reduce((total, tokens) => total + tokens.size, 0)
    };
  }
}

// Notification templates
export const NotificationTemplates = {
  ORDER_CONFIRMED: (orderNumber: string): PushNotificationData => ({
    title: 'Order Confirmed',
    body: `Your order #${orderNumber} has been confirmed and is being prepared.`,
    icon: '/icons/order-confirmed.png',
    data: { type: 'order_update', orderNumber }
  }),

  ORDER_SHIPPED: (orderNumber: string): PushNotificationData => ({
    title: 'Order Shipped',
    body: `Your order #${orderNumber} is on its way!`,
    icon: '/icons/shipped.png',
    data: { type: 'order_update', orderNumber }
  }),

  ORDER_DELIVERED: (orderNumber: string): PushNotificationData => ({
    title: 'Order Delivered',
    body: `Your order #${orderNumber} has been delivered. Enjoy!`,
    icon: '/icons/delivered.png',
    data: { type: 'order_update', orderNumber }
  }),

  PAYMENT_SUCCESSFUL: (amount: string): PushNotificationData => ({
    title: 'Payment Successful',
    body: `Your payment of ₦${amount} was processed successfully.`,
    icon: '/icons/payment-success.png',
    data: { type: 'payment_update' }
  }),

  DRIVER_ASSIGNED: (driverName: string): PushNotificationData => ({
    title: 'Driver Assigned',
    body: `${driverName} has been assigned to your delivery.`,
    icon: '/icons/driver-assigned.png',
    data: { type: 'delivery_update' }
  })
};

export const pushNotificationService = new PushNotificationService();
export { PushNotificationService, PushNotificationData, NotificationTarget, NotificationOptions };
