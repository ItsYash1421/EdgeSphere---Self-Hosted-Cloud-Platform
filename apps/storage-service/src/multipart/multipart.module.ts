import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MultipartController } from './multipart.controller';
import { MultipartService } from './multipart.service';
import { MinioModule } from '../minio/minio.module';
import { FileEntity } from '../files/file.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity]), MinioModule, EventsModule],
  controllers: [MultipartController],
  providers: [MultipartService],
})
export class MultipartModule {}
