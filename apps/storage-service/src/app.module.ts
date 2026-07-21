import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BucketsModule } from './buckets/buckets.module';
import { FilesModule } from './files/files.module';
import { BucketEntity } from './buckets/bucket.entity';
import { FileEntity } from './files/file.entity';
import { MinioModule } from './minio/minio.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'storage'),
        entities: [BucketEntity, FileEntity],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    MinioModule,
    BucketsModule,
    FilesModule,
  ],
})
export class AppModule {}
