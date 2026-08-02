import { Module } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { PlatformConfigController } from './platform-config.controller';

@Module({
  controllers: [PlatformConfigController],
  providers: [PlatformConfigService],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
