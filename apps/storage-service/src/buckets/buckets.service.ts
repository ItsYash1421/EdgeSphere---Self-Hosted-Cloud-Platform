import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BucketEntity } from './bucket.entity';
import { CreateBucketDto } from './dto/bucket.dto';
import { MinioService } from '../minio/minio.service';
import { FileEntity } from '../files/file.entity';

@Injectable()
export class BucketsService {
  constructor(
    @InjectRepository(BucketEntity)
    private readonly bucketRepo: Repository<BucketEntity>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    private readonly minioService: MinioService,
  ) {}

  async createBucket(userId: string, dto: CreateBucketDto): Promise<BucketEntity> {
    const existing = await this.bucketRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('Bucket name already exists');
    }

    const existsInMinio = await this.minioService.bucketExists(dto.name);
    if (!existsInMinio) {
      await this.minioService.createBucket(dto.name, dto.region || 'us-east-1');
    }

    const bucket = this.bucketRepo.create({
      userId,
      name: dto.name,
      region: dto.region || 'us-east-1',
      isPublic: dto.isPublic || false,
    });
    return this.bucketRepo.save(bucket);
  }

  async listBuckets(userId: string): Promise<BucketEntity[]> {
    return this.bucketRepo.find({ where: { userId } });
  }

  async getBucket(userId: string, name: string): Promise<BucketEntity> {
    const bucket = await this.bucketRepo.findOne({ where: { userId, name } });
    if (!bucket) {
      throw new NotFoundException('Bucket not found');
    }
    return bucket;
  }

  async deleteBucket(userId: string, name: string): Promise<void> {
    const bucket = await this.getBucket(userId, name);
    
    const count = await this.fileRepo.count({ where: { bucketId: bucket.id } });
    if (count > 0) {
      throw new BadRequestException('Bucket is not empty');
    }

    const exists = await this.minioService.bucketExists(name);
    if (exists) {
      await this.minioService.deleteBucket(name);
    }

    await this.bucketRepo.remove(bucket);
  }
}
