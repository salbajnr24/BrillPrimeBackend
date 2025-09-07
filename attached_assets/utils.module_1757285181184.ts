import { Module } from '@nestjs/common';
import { EncryptionUtilsService } from './encryption';
// import { JwtUtilsService } from './jwt';
import { TimeUtilsService } from './time';

// import { DiscordUtilsService } from './discord';

@Module({
  imports: [],
  providers: [
    EncryptionUtilsService,
    // JwtUtilsService,
    TimeUtilsService,
    // DiscordUtilsService,
  ],
  exports: [
    EncryptionUtilsService,
    // JwtUtilsService,
    TimeUtilsService,
    // DiscordUtilsService,
  ],
})
export class UtilsServicesModule {}
