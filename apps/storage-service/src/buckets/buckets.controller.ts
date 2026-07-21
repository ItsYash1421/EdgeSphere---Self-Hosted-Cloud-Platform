import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BucketsService } from './buckets.service';
import { CreateBucketDto } from './dto/bucket.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('storage/buckets')
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  @Post()
  createBucket(@Request() req, @Body() dto: CreateBucketDto) {
    return this.bucketsService.createBucket(req.user.sub, dto);
  }

  @Get()
  listBuckets(@Request() req) {
    return this.bucketsService.listBuckets(req.user.sub);
  }

  @Get(':name')
  getBucket(@Request() req, @Param('name') name: string) {
    return this.bucketsService.getBucket(req.user.sub, name);
  }

  @Delete(':name')
  deleteBucket(@Request() req, @Param('name') name: string) {
    return this.bucketsService.deleteBucket(req.user.sub, name);
  }
}
