
import EventEmitter from 'events';
import { messageQueue, JobTypes } from './messageQueue';

interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: { lat: number; lng: number; };
    };
  };
}

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

interface AggregatedMetric {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  period: string;
  timestamp: Date;
}

class RealtimeAnalyticsService extends EventEmitter {
  private events: Map<string, AnalyticsEvent[]> = new Map();
  private metrics: Map<string, MetricData[]> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetric[]> = new Map();
  private sessionData: Map<string, any> = new Map();
  private retentionWindow = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    super();
    
    // Register message queue handler for analytics processing
    messageQueue.registerHandler(JobTypes.UPDATE_ANALYTICS, this.processAnalyticsJob.bind(this));
    
    // Start cleanup interval
    setInterval(() => this.cleanup(), 60 * 60 * 1000); // Cleanup every hour
  }

  // Event tracking
  async trackEvent(
    eventType: string,
    data: Record<string, any>,
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: AnalyticsEvent['metadata'];
    } = {}
  ): Promise<void> {
    const event: AnalyticsEvent = {
      eventType,
      userId: options.userId,
      sessionId: options.sessionId,
      timestamp: new Date(),
      data,
      metadata: options.metadata
    };

    // Store event
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType)!.push(event);

    // Emit for real-time listeners
    this.emit('event', event);

    // Queue for batch processing
    await messageQueue.add(JobTypes.UPDATE_ANALYTICS, {
      type: 'event',
      data: event
    });
  }

  // Metric tracking
  async recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): Promise<void> {
    const metric: MetricData = {
      name,
      value,
      tags,
      timestamp: new Date()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Emit for real-time listeners
    this.emit('metric', metric);

    // Queue for aggregation
    await messageQueue.add(JobTypes.UPDATE_ANALYTICS, {
      type: 'metric',
      data: metric
    });
  }

  // Session tracking
  startSession(sessionId: string, userId?: string, metadata: any = {}): void {
    this.sessionData.set(sessionId, {
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      metadata,
      events: 0,
      duration: 0
    });

    this.trackEvent('session_start', { sessionId, userId }, { sessionId, userId });
  }

  updateSession(sessionId: string, data: any = {}): void {
    const session = this.sessionData.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      session.events++;
      session.duration = session.lastActivity.getTime() - session.startTime.getTime();
      Object.assign(session, data);
    }
  }

  endSession(sessionId: string): void {
    const session = this.sessionData.get(sessionId);
    if (session) {
      session.endTime = new Date();
      session.duration = session.endTime.getTime() - session.startTime.getTime();

      this.trackEvent('session_end', {
        sessionId,
        duration: session.duration,
        events: session.events
      }, { sessionId, userId: session.userId });

      this.sessionData.delete(sessionId);
    }
  }

  // Real-time queries
  getEventCount(eventType: string, timeRange: { start: Date; end: Date }): number {
    const events = this.events.get(eventType) || [];
    return events.filter(event =>
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    ).length;
  }

  getEvents(
    eventType: string,
    filters: {
      userId?: string;
      timeRange?: { start: Date; end: Date };
      limit?: number;
    } = {}
  ): AnalyticsEvent[] {
    let events = this.events.get(eventType) || [];

    if (filters.userId) {
      events = events.filter(event => event.userId === filters.userId);
    }

    if (filters.timeRange) {
      events = events.filter(event =>
        event.timestamp >= filters.timeRange!.start &&
        event.timestamp <= filters.timeRange!.end
      );
    }

    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filters.limit ? events.slice(0, filters.limit) : events;
  }

  getMetrics(
    name: string,
    timeRange: { start: Date; end: Date }
  ): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.filter(metric =>
      metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
    );
  }

  getAggregatedMetrics(
    name: string,
    period: '1h' | '1d' | '7d' | '30d'
  ): AggregatedMetric[] {
    return this.aggregatedMetrics.get(`${name}_${period}`) || [];
  }

  // Dashboard data
  getDashboardData(): any {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      realtime: {
        activeUsers: this.sessionData.size,
        eventsLastHour: Array.from(this.events.values())
          .flat()
          .filter(event => event.timestamp >= oneHourAgo).length,
        topEvents: this.getTopEvents(oneHourAgo, now)
      },
      today: {
        totalEvents: Array.from(this.events.values())
          .flat()
          .filter(event => event.timestamp >= oneDayAgo).length,
        uniqueUsers: new Set(
          Array.from(this.events.values())
            .flat()
            .filter(event => event.timestamp >= oneDayAgo && event.userId)
            .map(event => event.userId)
        ).size,
        avgSessionDuration: this.getAverageSessionDuration(oneDayAgo, now)
      },
      metrics: Array.from(this.metrics.keys()).map(name => ({
        name,
        currentValue: this.getLatestMetricValue(name),
        trend: this.getMetricTrend(name, oneHourAgo, now)
      }))
    };
  }

  // User analytics
  getUserAnalytics(userId: string, timeRange: { start: Date; end: Date }): any {
    const userEvents = Array.from(this.events.values())
      .flat()
      .filter(event =>
        event.userId === userId &&
        event.timestamp >= timeRange.start &&
        event.timestamp <= timeRange.end
      );

    const eventTypes = [...new Set(userEvents.map(event => event.eventType))];
    const sessionIds = [...new Set(userEvents.map(event => event.sessionId).filter(Boolean))];

    return {
      totalEvents: userEvents.length,
      eventTypes,
      sessions: sessionIds.length,
      firstSeen: userEvents.length > 0 ? 
        Math.min(...userEvents.map(e => e.timestamp.getTime())) : null,
      lastSeen: userEvents.length > 0 ?
        Math.max(...userEvents.map(e => e.timestamp.getTime())) : null,
      mostFrequentEvents: this.getMostFrequentEvents(userEvents)
    };
  }

  private async processAnalyticsJob(job: any): Promise<void> {
    const { type, data } = job.data;

    if (type === 'event') {
      // Process event for aggregation
      await this.aggregateEvent(data);
    } else if (type === 'metric') {
      // Process metric for aggregation
      await this.aggregateMetric(data);
    }
  }

  private async aggregateEvent(event: AnalyticsEvent): Promise<void> {
    // Implement event aggregation logic
    // This could include updating counters, calculating rates, etc.
  }

  private async aggregateMetric(metric: MetricData): Promise<void> {
    // Implement metric aggregation logic
    const periods = ['1h', '1d', '7d', '30d'];
    
    for (const period of periods) {
      const key = `${metric.name}_${period}`;
      let aggregated = this.aggregatedMetrics.get(key) || [];
      
      // Find or create aggregated metric for current period
      const periodStart = this.getPeriodStart(period, metric.timestamp);
      let existing = aggregated.find(a => a.timestamp.getTime() === periodStart.getTime());
      
      if (!existing) {
        existing = {
          name: metric.name,
          count: 0,
          sum: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
          period,
          timestamp: periodStart
        };
        aggregated.push(existing);
      }
      
      existing.count++;
      existing.sum += metric.value;
      existing.avg = existing.sum / existing.count;
      existing.min = Math.min(existing.min, metric.value);
      existing.max = Math.max(existing.max, metric.value);
      
      this.aggregatedMetrics.set(key, aggregated);
    }
  }

  private getPeriodStart(period: string, timestamp: Date): Date {
    const date = new Date(timestamp);
    
    switch (period) {
      case '1h':
        date.setMinutes(0, 0, 0);
        break;
      case '1d':
        date.setHours(0, 0, 0, 0);
        break;
      case '7d':
        date.setDate(date.getDate() - date.getDay());
        date.setHours(0, 0, 0, 0);
        break;
      case '30d':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }

  private getTopEvents(start: Date, end: Date): Array<{ eventType: string; count: number }> {
    const eventCounts = new Map<string, number>();
    
    for (const [eventType, events] of this.events) {
      const count = events.filter(event =>
        event.timestamp >= start && event.timestamp <= end
      ).length;
      
      if (count > 0) {
        eventCounts.set(eventType, count);
      }
    }
    
    return Array.from(eventCounts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getAverageSessionDuration(start: Date, end: Date): number {
    const sessions = Array.from(this.sessionData.values())
      .filter(session => session.startTime >= start && session.startTime <= end);
    
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    return totalDuration / sessions.length;
  }

  private getLatestMetricValue(name: string): number {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return 0;
    
    const latest = metrics.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest
    );
    
    return latest.value;
  }

  private getMetricTrend(name: string, start: Date, end: Date): 'up' | 'down' | 'stable' {
    const metrics = this.getMetrics(name, { start, end });
    if (metrics.length < 2) return 'stable';
    
    const firstValue = metrics[0].value;
    const lastValue = metrics[metrics.length - 1].value;
    const change = (lastValue - firstValue) / firstValue;
    
    if (change > 0.05) return 'up';
    if (change < -0.05) return 'down';
    return 'stable';
  }

  private getMostFrequentEvents(events: AnalyticsEvent[]): Array<{ eventType: string; count: number }> {
    const counts = new Map<string, number>();
    
    for (const event of events) {
      counts.set(event.eventType, (counts.get(event.eventType) || 0) + 1);
    }
    
    return Array.from(counts.entries())
      .map(([eventType, count]) => ({ eventType, count }))
      .sort((a, b) => b.count - a.count);
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.retentionWindow);
    
    // Clean up old events
    for (const [eventType, events] of this.events) {
      const filteredEvents = events.filter(event => event.timestamp >= cutoff);
      if (filteredEvents.length > 0) {
        this.events.set(eventType, filteredEvents);
      } else {
        this.events.delete(eventType);
      }
    }
    
    // Clean up old metrics
    for (const [name, metrics] of this.metrics) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp >= cutoff);
      if (filteredMetrics.length > 0) {
        this.metrics.set(name, filteredMetrics);
      } else {
        this.metrics.delete(name);
      }
    }
  }
}

export const realtimeAnalyticsService = new RealtimeAnalyticsService();
export { RealtimeAnalyticsService, AnalyticsEvent, MetricData, AggregatedMetric };
interface AnalyticsEvent {
  event: string;
  data: any;
  timestamp: Date;
  userId?: number;
}

class RealtimeAnalyticsService {
  private events: AnalyticsEvent[] = [];

  async trackEvent(event: string, data: any, userId?: number): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      event,
      data,
      timestamp: new Date(),
      userId
    };

    this.events.push(analyticsEvent);
    console.log('Analytics event tracked:', analyticsEvent);

    // In production, you would send this to your analytics service
    // e.g., Google Analytics, Mixpanel, etc.
  }

  async getEvents(filters?: { 
    event?: string; 
    userId?: number; 
    startDate?: Date; 
    endDate?: Date 
  }): Promise<AnalyticsEvent[]> {
    let filteredEvents = this.events;

    if (filters?.event) {
      filteredEvents = filteredEvents.filter(e => e.event === filters.event);
    }

    if (filters?.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    }

    if (filters?.startDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= filters.endDate!);
    }

    return filteredEvents;
  }

  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    this.events.forEach(event => {
      counts[event.event] = (counts[event.event] || 0) + 1;
    });

    return counts;
  }
}

export const realtimeAnalyticsService = new RealtimeAnalyticsService();
