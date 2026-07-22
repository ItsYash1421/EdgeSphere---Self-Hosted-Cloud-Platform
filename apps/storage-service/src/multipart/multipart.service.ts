import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MinioService } from '../minio/minio.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from '../files/file.entity';
import { InitiateUploadResponse, UploadStatus } from './dto/multipart.dto';
import { v4 as uuidv4 } from 'uuid';
import { StorageEventPublisherService } from '../events/storage-event-publisher.service';

@Injectable()
export class MultipartService {
  // Using an in-memory map to simulate Redis for this phase
  private redisStore: Map<string, any> = new Map();

  constructor(
    private readonly minioService: MinioService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly storageEventPublisher: StorageEventPublisherService,
  ) {}

  async initiateUpload(userId: string, bucketName: string, key: string, contentType: string, totalSize: number): Promise<InitiateUploadResponse> {
    const uploadId = uuidv4();
    const partSize = 5 * 1024 * 1024; // 5MB
    const partCount = totalSize <= partSize ? 1 : Math.ceil(totalSize / partSize);
    
    // Create MinIO multipart upload
    const minioUploadId = await this.minioService.getClient.initiateNewMultipartUpload(bucketName, key, { 'Content-Type': contentType });
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    this.redisStore.set(`multipart:${uploadId}`, {
      uploadId: minioUploadId,
      internalUploadId: uploadId,
      bucketName,
      key,
      userId,
      contentType,
      totalSize,
      partCount,
      completedParts: [],
      createdAt: new Date(),
      expiresAt
    });

    return { uploadId, partCount, partSize, expiresAt };
  }

  async uploadPart(uploadId: string, partNumber: number, data: Buffer): Promise<{ partNumber: number; etag: string; uploadedBytes: number }> {
    const session = this.redisStore.get(`multipart:${uploadId}`);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }
    if (partNumber < 1 || partNumber > session.partCount) {
      throw new BadRequestException('Invalid part number');
    }

    const etag = await this.minioService.getClient.uploadPart(session.bucketName, session.key, partNumber, data, data.length, session.uploadId);
    
    session.completedParts.push({ partNumber, etag, size: data.length });
    this.redisStore.set(`multipart:${uploadId}`, session);

    return { partNumber, etag, uploadedBytes: data.length };
  }

  async completeUpload(uploadId: string, userId: string): Promise<FileEntity> {
    const session = this.redisStore.get(`multipart:${uploadId}`);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }
    
    if (session.completedParts.length !== session.partCount) {
      throw new BadRequestException('Not all parts completed');
    }

    // Sort parts before completing
    const sortedParts = session.completedParts.sort((a: any, b: any) => a.partNumber - b.partNumber).map((p: any) => ({ partNumber: p.partNumber, etag: p.etag }));
    
    await this.minioService.getClient.completeMultipartUpload(session.bucketName, session.key, session.uploadId, sortedParts);
    
    // Save to Postgres
    const fileRecord = this.fileRepo.create({
      bucketId: session.bucketName, // Note: bucketId in DB is normally UUID, but simulating bucketName here or we need bucketRepo
      key: session.key,
      size: session.totalSize,
      contentType: session.contentType,
      etag: 'multipart-etag', // Complete returns an etag, but minio v8 doesn't return it directly in completeMultipartUpload without parsing XML.
      metadata: {},
    });
    const savedFile = await this.fileRepo.save(fileRecord);
    
    this.redisStore.delete(`multipart:${uploadId}`);
    
    await this.storageEventPublisher.publishStorageEvent({
      type: 'file.uploaded',
      bucket: session.bucketName,
      key: session.key,
      size: session.totalSize
    });

    return savedFile;
  }

  async abortUpload(uploadId: string, userId: string): Promise<void> {
    const session = this.redisStore.get(`multipart:${uploadId}`);
    if (!session) return;
    
    await this.minioService.getClient.abortMultipartUpload(session.bucketName, session.key, session.uploadId);
    this.redisStore.delete(`multipart:${uploadId}`);
  }

  async getUploadStatus(uploadId: string, userId: string): Promise<UploadStatus> {
    const session = this.redisStore.get(`multipart:${uploadId}`);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    return {
      uploadId,
      key: session.key,
      totalSize: session.totalSize,
      completedParts: session.completedParts.length,
      totalParts: session.partCount,
      progress: Math.round((session.completedParts.length / session.partCount) * 100),
      expiresAt: session.expiresAt,
      status: 'in_progress'
    };
  }
}
