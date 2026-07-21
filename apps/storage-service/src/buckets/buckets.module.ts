import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketsController } from './buckets.controller';
import { BucketsService } from './buckets.service';
import { BucketEntity } from './bucket.entity';
import { FileEntity } from '../files/file.entity';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [TypeOrmModule.forFeature([BucketEntity, FileEntity]), MinioModule],
  controllers: [BucketsController],
  providers: [BucketsService],
  exports: [BucketsService],
})
export class BucketsModule {}
