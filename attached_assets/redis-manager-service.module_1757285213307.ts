import { redisStore } from 'cache-manager-redis-store';
import { Module } from '@nestjs/common';
import config from './redis-config';
import { RedisService } from './redis.service';
import { CacheModule } from '@nestjs/cache-manager';
import type { RedisClientOptions } from 'redis';

@Module({
  imports: [
    CacheModule.register<RedisClientOptions>({
      store: redisStore,
      ...config,
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisServiceModule {}
