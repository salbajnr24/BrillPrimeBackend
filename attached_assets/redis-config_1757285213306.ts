import { REDIS_CLIENT_NAME, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from 'src/common/env';

export default {
  retry_strategy: function (options: any) {
    // End reconnecting on a specific error and flush all commands with
    // a individual error
    if (options.error && options.error.code === 'ECONNREFUSED') return new Error('The server refused the connection');
    // End reconnecting after a specific timeout and flush all commands
    // with a individual error
    if (options.total_retry_time > 1000 * 60 * 60) return new Error('Retry time exhausted');
    // End reconnecting with built in error
    if (options.attempt > 10) return undefined;
    // reconnect after
    return Math.min(options.attempt * 100, 3000);
  },
  // name: String(REDIS_CLIENT_NAME),
  // port: Number(REDIS_PORT),
  // host: String(REDIS_HOST),
  // auth_pass: String(REDIS_PASSWORD),
  // password: String(REDIS_PASSWORD),

  name: String(REDIS_CLIENT_NAME),
  port: Number(REDIS_PORT), // 6379
  host: String(REDIS_HOST), // oregon-redis.render.com
  username: String(REDIS_USERNAME), // red-cuphmq3tq21c739s26rg
  password: String(REDIS_PASSWORD), // iifWhGjudLtanQ76XA9w1M4Bh9ir6Aiy
  // tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined, // Enable TLS if usin
  // ioredis setup
  reconnectOnError(err: any) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // or `return 1;`
    }
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
