import { Module } from '@nestjs/common';
import { InMemoryCacheServiceModule } from './in-memory-cache/in-memory-cache.module';
import { RedisServiceModule } from './redis/redis-manager-service.module';
import { InMemoryCacheService } from './in-memory-cache/in-memory-cache.service';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [InMemoryCacheServiceModule, RedisServiceModule],
  providers: [
    {
      provide: 'InMemory',
      useExisting: InMemoryCacheService,
    },
    {
      provide: 'Redis',
      useExisting: RedisService,
    },
  ],
  exports: ['InMemory', 'Redis'],
})
export class CacheServicesModule {}
