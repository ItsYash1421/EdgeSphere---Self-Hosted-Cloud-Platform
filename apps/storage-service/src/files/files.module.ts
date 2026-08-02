import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileEntity } from './file.entity';
import { BucketEntity } from '../buckets/bucket.entity';
import { MinioModule } from '../minio/minio.module';
import { PlatformConfigService } from '../config/platform-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity, BucketEntity]), MinioModule],
  controllers: [FilesController],
  providers: [FilesService, PlatformConfigService],
  exports: [FilesService],
})
export class FilesModule {}
