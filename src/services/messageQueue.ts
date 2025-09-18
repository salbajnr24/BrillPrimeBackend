
import EventEmitter from 'events';

interface QueueJob {
  id: string;
  type: string;
  data: any;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
}

interface QueueOptions {
  concurrency?: number;
  defaultMaxAttempts?: number;
  retryDelay?: number;
}

class MessageQueue extends EventEmitter {
  private jobs: Map<string, QueueJob> = new Map();
  private processing: Set<string> = new Set();
  private handlers: Map<string, (job: QueueJob) => Promise<any>> = new Map();
  private options: Required<QueueOptions>;
  private isProcessing = false;

  constructor(options: QueueOptions = {}) {
    super();
    this.options = {
      concurrency: options.concurrency || 5,
      defaultMaxAttempts: options.defaultMaxAttempts || 3,
      retryDelay: options.retryDelay || 5000
    };
  }

  async add(type: string, data: any, options: {
    priority?: number;
    maxAttempts?: number;
    delay?: number;
  } = {}): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scheduledAt = options.delay ? new Date(Date.now() + options.delay) : undefined;

    const job: QueueJob = {
      id: jobId,
      type,
      data,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.options.defaultMaxAttempts,
      createdAt: new Date(),
      scheduledAt
    };

    this.jobs.set(jobId, job);
    this.emit('job:added', job);

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return jobId;
  }

  registerHandler(type: string, handler: (job: QueueJob) => Promise<any>): void {
    this.handlers.set(type, handler);
  }

  async remove(jobId: string): Promise<boolean> {
    if (this.processing.has(jobId)) {
      return false; // Cannot remove job that's being processed
    }

    return this.jobs.delete(jobId);
  }

  async getJob(jobId: string): Promise<QueueJob | undefined> {
    return this.jobs.get(jobId);
  }

  getStats() {
    const pending = Array.from(this.jobs.values()).filter(job => 
      !this.processing.has(job.id) && (!job.scheduledAt || job.scheduledAt <= new Date())
    ).length;
    
    const scheduled = Array.from(this.jobs.values()).filter(job => 
      job.scheduledAt && job.scheduledAt > new Date()
    ).length;

    return {
      pending,
      processing: this.processing.size,
      scheduled,
      total: this.jobs.size
    };
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.processJobs();
  }

  private async processJobs(): Promise<void> {
    if (this.processing.size >= this.options.concurrency) {
      return;
    }

    const availableJobs = Array.from(this.jobs.values())
      .filter(job => 
        !this.processing.has(job.id) && 
        (!job.scheduledAt || job.scheduledAt <= new Date())
      )
      .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());

    const job = availableJobs[0];
    if (!job) {
      // No jobs to process, stop processing
      this.isProcessing = false;
      return;
    }

    this.processing.add(job.id);
    this.processJob(job).finally(() => {
      this.processing.delete(job.id);
      // Continue processing more jobs
      setImmediate(() => this.processJobs());
    });

    // Process more jobs concurrently if possible
    if (this.processing.size < this.options.concurrency) {
      setImmediate(() => this.processJobs());
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      this.emit('job:error', job, new Error(`No handler registered for job type: ${job.type}`));
      this.jobs.delete(job.id);
      return;
    }

    job.attempts++;
    this.emit('job:started', job);

    try {
      const result = await handler(job);
      this.emit('job:completed', job, result);
      this.jobs.delete(job.id);
    } catch (error) {
      this.emit('job:error', job, error);

      if (job.attempts >= job.maxAttempts) {
        this.emit('job:failed', job, error);
        this.jobs.delete(job.id);
      } else {
        // Retry after delay
        job.scheduledAt = new Date(Date.now() + this.options.retryDelay);
        this.emit('job:retry', job);
      }
    }
  }

  async stop(): Promise<void> {
    this.isProcessing = false;
    
    // Wait for all processing jobs to complete
    while (this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Default message queue instance
export const messageQueue = new MessageQueue();

// Job types
export const JobTypes = {
  SEND_EMAIL: 'send_email',
  PROCESS_PAYMENT: 'process_payment',
  SEND_NOTIFICATION: 'send_notification',
  UPDATE_ANALYTICS: 'update_analytics',
  SYNC_DATA: 'sync_data'
} as const;

export { MessageQueue, QueueJob, QueueOptions };
