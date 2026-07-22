import { Controller, Post, Delete, Get, Body, Query } from '@nestjs/common';
import { InvalidationService } from './invalidation.service';
import { PurgeFileDto, PurgeBucketDto, PurgePrefixDto } from './dto/purge.dto';

@Controller('cache')
export class InvalidationController {
  constructor(private readonly invalidationService: InvalidationService) {}

  @Post('purge')
  async purgeFile(@Body() dto: PurgeFileDto) {
    return this.invalidationService.purge(dto.bucket, dto.key);
  }

  @Post('purge/bucket')
  async purgeBucket(@Body() dto: PurgeBucketDto) {
    return this.invalidationService.purgeBucket(dto.bucket);
  }

  @Post('purge/prefix')
  async purgePrefix(@Body() dto: PurgePrefixDto) {
    return this.invalidationService.purgePrefix(dto.bucket, dto.prefix);
  }

  @Delete('purge/all')
  async purgeAll() {
    // Note: Add admin guard here in production
    return this.invalidationService.purgeAll();
  }

  @Get('stats')
  async getStats() {
    return this.invalidationService.getCacheStats();
  }

  @Get('history')
  async getHistory(@Query('limit') limit?: number) {
    return this.invalidationService.getPurgeHistory(limit ? Number(limit) : 100);
  }
}
