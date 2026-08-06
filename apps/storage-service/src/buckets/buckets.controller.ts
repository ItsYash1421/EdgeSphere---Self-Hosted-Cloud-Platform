import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
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
  listBuckets(
    @Request() req,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number
  ) {
    return this.bucketsService.listBuckets(req.user.sub, page || 1, pageSize || 50);
  }

  @Get(':name')
  getBucket(@Request() req, @Param('name') name: string) {
    return this.bucketsService.getBucket(req.user.sub, name);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBucket(@Request() req, @Param('name') name: string) {
    return this.bucketsService.deleteBucket(req.user.sub, name);
  }
}
