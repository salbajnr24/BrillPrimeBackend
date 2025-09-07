import { Module } from '@nestjs/common';
import { CommoditiesService } from './commodities.service';
import { CommoditiesController } from './commodities.controller';

@Module({
  providers: [CommoditiesService],
  controllers: [CommoditiesController],
})
export class CommoditiesModule {}
