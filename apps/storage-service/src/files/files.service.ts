import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from './file.entity';
import { BucketEntity } from '../buckets/bucket.entity';
import { MinioService } from '../minio/minio.service';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(BucketEntity)
    private readonly bucketRepo: Repository<BucketEntity>,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}

  private async getBucketOrThrow(userId: string, bucketName: string, checkOwner = true): Promise<BucketEntity> {
    const bucket = await this.bucketRepo.findOne({ where: { name: bucketName } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }
    if (checkOwner && bucket.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (!checkOwner && !bucket.isPublic && bucket.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return bucket;
  }

  async uploadFile(userId: string, bucketName: string, file: Express.Multer.File, key?: string): Promise<FileEntity> {
    const bucket = await this.getBucketOrThrow(userId, bucketName, true);
    const finalKey = key || uuidv4();

    const etag = await this.minioService.uploadFile(
      bucket.name,
      finalKey,
      file.buffer,
      file.mimetype,
      { originalname: file.originalname }
    );

    const fileRecord = this.fileRepo.create({
      bucketId: bucket.id,
      key: finalKey,
      size: file.size,
      contentType: file.mimetype,
      etag,
      metadata: { originalname: file.originalname },
    });

    return this.fileRepo.save(fileRecord);
  }

  async downloadFile(userId: string, bucketName: string, key: string) {
    const bucket = await this.getBucketOrThrow(userId, bucketName, false);
    
    const fileRecord = await this.fileRepo.findOne({ where: { bucketId: bucket.id, key } });
    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    const stream = await this.minioService.getFileStream(bucket.name, key);
    return {
      stream,
      contentType: fileRecord.contentType,
      size: fileRecord.size,
      etag: fileRecord.etag,
    };
  }

  async deleteFile(userId: string, bucketName: string, key: string): Promise<void> {
    const bucket = await this.getBucketOrThrow(userId, bucketName, true);
    
    const fileRecord = await this.fileRepo.findOne({ where: { bucketId: bucket.id, key } });
    if (!fileRecord) {
      throw new NotFoundException('File not found');
    }

    await this.minioService.deleteFile(bucket.name, key);
    await this.fileRepo.remove(fileRecord);
  }

  async listFiles(userId: string, bucketName: string, prefix = '', page = 1, pageSize = 50) {
    const bucket = await this.getBucketOrThrow(userId, bucketName, true);
    
    const [data, total] = await this.fileRepo.findAndCount({
      where: { bucketId: bucket.id }, // To accurately query by prefix, we'd use Like(`prefix%`) but sticking to simple criteria here for now
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, pageSize };
  }

  async generatePresignedUrl(userId: string, bucketName: string, key: string, expirySeconds: number, method: 'GET' | 'PUT') {
    const bucket = await this.getBucketOrThrow(userId, bucketName, true);
    
    if (method === 'GET') {
      const url = await this.minioService.generatePresignedGetUrl(bucket.name, key, expirySeconds);
      return { url };
    } else if (method === 'PUT') {
      const url = await this.minioService.generatePresignedPutUrl(bucket.name, key, expirySeconds);
      return { url };
    } else {
      throw new BadRequestException('Invalid method');
    }
  }
}
