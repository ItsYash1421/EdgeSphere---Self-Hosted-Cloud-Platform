import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient, BucketItem } from 'minio';
import { createLogger } from '@edgesphere/logger';

const logger = createLogger('storage-service:minio');

/**
 * MinioService wraps the MinIO client with typed methods.
 * All storage operations go through this service.
 *
 * MinIO is S3-compatible, so this code would also work with AWS S3
 * by swapping the client configuration.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private client: MinioClient;

  constructor(private readonly config: ConfigService) {
    this.client = new MinioClient({
      endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
      port: config.get<number>('MINIO_PORT', 9000),
      useSSL: config.get('MINIO_USE_SSL') === 'true',
      accessKey: config.getOrThrow('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit() {
    logger.info('MinIO client initialized');
    await this.ensureSystemBucket();
  }

  /** Ensure the internal system bucket exists */
  private async ensureSystemBucket() {
    const systemBucket = 'edgesphere-system';
    const exists = await this.client.bucketExists(systemBucket);
    if (!exists) {
      await this.client.makeBucket(systemBucket, 'us-east-1');
      logger.info({ bucket: systemBucket }, 'Created system bucket');
    }
  }

  /** Create a new MinIO bucket */
  async createBucket(name: string, region = 'us-east-1'): Promise<void> {
    await this.client.makeBucket(name, region);
    logger.info({ bucket: name, region }, 'Bucket created');
  }

  /** Check if a bucket exists */
  async bucketExists(name: string): Promise<boolean> {
    return this.client.bucketExists(name);
  }

  /** Delete a bucket (must be empty) */
  async deleteBucket(name: string): Promise<void> {
    await this.client.removeBucket(name);
    logger.info({ bucket: name }, 'Bucket deleted');
  }

  /** Upload a file to MinIO */
  async uploadFile(
    bucket: string,
    key: string,
    data: Buffer,
    contentType: string,
    metadata: Record<string, string> = {},
  ): Promise<string> {
    const result = await this.client.putObject(bucket, key, data, data.length, {
      'Content-Type': contentType,
      ...metadata,
    });

    logger.info({ bucket, key, etag: result.etag, size: data.length }, 'File uploaded');
    return result.etag;
  }

  /** Stream a file from MinIO */
  async getFileStream(bucket: string, key: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(bucket, key);
  }

  /** Get file as buffer */
  async getFile(bucket: string, key: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, key);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /** Get file metadata (stat) */
  async getFileStat(bucket: string, key: string) {
    return this.client.statObject(bucket, key);
  }

  /** Delete a file */
  async deleteFile(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
    logger.info({ bucket, key }, 'File deleted');
  }

  /** List files in a bucket with optional prefix */
  async listFiles(bucket: string, prefix = '', recursive = true): Promise<BucketItem[]> {
    const stream = this.client.listObjects(bucket, prefix, recursive);
    const items: BucketItem[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (item: BucketItem) => items.push(item));
      stream.on('end', () => resolve(items));
      stream.on('error', reject);
    });
  }

  /**
   * Generate a presigned URL for GET access.
   * Expires after `expirySeconds` seconds.
   */
  async generatePresignedGetUrl(
    bucket: string,
    key: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedGetObject(bucket, key, expirySeconds);
  }

  /**
   * Generate a presigned URL for PUT (upload).
   * Allows clients to upload directly to MinIO without going through our service.
   */
  async generatePresignedPutUrl(
    bucket: string,
    key: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedPutObject(bucket, key, expirySeconds);
  }

  /**
   * Initiate a multipart upload.
   * For files > 100MB, upload in parts for reliability and resumability.
   */
  async initiateMultipartUpload(bucket: string, key: string): Promise<string> {
    // MinIO handles multipart internally via the minio SDK
    // Return a composite upload ID for tracking
    return `${bucket}/${key}/${Date.now()}`;
  }
}
