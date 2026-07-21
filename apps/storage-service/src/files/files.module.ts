import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileEntity } from './file.entity';
import { BucketEntity } from '../buckets/bucket.entity';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity, BucketEntity]), MinioModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
