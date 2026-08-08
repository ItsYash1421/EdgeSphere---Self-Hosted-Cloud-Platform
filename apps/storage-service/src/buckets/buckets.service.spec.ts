import { Test, TestingModule } from '@nestjs/testing';
import { BucketsService } from './buckets.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { BucketEntity } from './bucket.entity';
import { FileEntity } from '../files/file.entity';
import { MinioService } from '../minio/minio.service';

jest.mock('@edgesphere/shared', () => ({ UserRole: { USER: 'user', ADMIN: 'admin' } }));
jest.mock('@edgesphere/logger', () => ({ createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }) }));


const mockBucketRepo = {
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};
const mockFileRepo = {
  count: jest.fn(),
};
const mockMinio = {
  bucketExists: jest.fn(),
  createBucket: jest.fn(),
  deleteBucket: jest.fn(),
};

const bucket = (overrides = {}): BucketEntity => ({
  id: 'bucket-uuid-1',
  userId: 'user-1',
  name: 'my-bucket',
  region: 'us-east-1',
  isPublic: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as BucketEntity);

describe('BucketsService', () => {
  let service: BucketsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BucketsService,
        { provide: getRepositoryToken(BucketEntity), useValue: mockBucketRepo },
        { provide: getRepositoryToken(FileEntity), useValue: mockFileRepo },
        { provide: MinioService, useValue: mockMinio },
      ],
    }).compile();
    service = module.get<BucketsService>(BucketsService);
  });

  describe('createBucket', () => {
    it('throws ConflictException when bucket name already exists in DB', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      await expect(service.createBucket('user-1', { name: 'my-bucket' }))
        .rejects.toThrow(ConflictException);
    });

    it('does not call minio.createBucket when bucket already exists in MinIO', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);
      mockMinio.bucketExists.mockResolvedValue(true);
      mockBucketRepo.create.mockReturnValue(bucket());
      mockBucketRepo.save.mockResolvedValue(bucket());

      await service.createBucket('user-1', { name: 'my-bucket' });

      expect(mockMinio.createBucket).not.toHaveBeenCalled();
    });

    it('creates bucket in MinIO when it does not exist', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);
      mockMinio.bucketExists.mockResolvedValue(false);
      mockBucketRepo.create.mockReturnValue(bucket());
      mockBucketRepo.save.mockResolvedValue(bucket());

      await service.createBucket('user-1', { name: 'my-bucket', region: 'eu-west-1' });

      expect(mockMinio.createBucket).toHaveBeenCalledWith('my-bucket', 'eu-west-1');
    });

    it('defaults to us-east-1 region when not provided', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);
      mockMinio.bucketExists.mockResolvedValue(false);
      mockBucketRepo.create.mockReturnValue(bucket());
      mockBucketRepo.save.mockResolvedValue(bucket());

      await service.createBucket('user-1', { name: 'my-bucket' });

      expect(mockMinio.createBucket).toHaveBeenCalledWith('my-bucket', 'us-east-1');
    });

    it('defaults isPublic to false when not provided', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);
      mockMinio.bucketExists.mockResolvedValue(false);
      mockBucketRepo.create.mockImplementation((dto) => ({ ...dto, id: 'bucket-uuid-1' }));
      mockBucketRepo.save.mockImplementation((b) => Promise.resolve(b));

      const result = await service.createBucket('user-1', { name: 'my-bucket' });

      expect(result.isPublic).toBe(false);
    });
  });

  describe('getBucket', () => {
    it('throws NotFoundException when bucket does not belong to user (ownership check)', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);
      await expect(service.getBucket('other-user', 'my-bucket')).rejects.toThrow(NotFoundException);
    });

    it('returns bucket when userId and name match', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      const result = await service.getBucket('user-1', 'my-bucket');
      expect(result.name).toBe('my-bucket');
    });
  });

  describe('deleteBucket', () => {
    it('throws BadRequestException when bucket still has files', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      mockFileRepo.count.mockResolvedValue(3);

      await expect(service.deleteBucket('user-1', 'my-bucket')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when bucket does not belong to user', async () => {
      mockBucketRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteBucket('other-user', 'my-bucket')).rejects.toThrow(NotFoundException);
    });

    it('deletes from MinIO only when bucket exists there', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      mockFileRepo.count.mockResolvedValue(0);
      mockMinio.bucketExists.mockResolvedValue(true);
      mockBucketRepo.remove.mockResolvedValue({});

      await service.deleteBucket('user-1', 'my-bucket');

      expect(mockMinio.deleteBucket).toHaveBeenCalledWith('my-bucket');
    });

    it('skips MinIO deletion when bucket does not exist there', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      mockFileRepo.count.mockResolvedValue(0);
      mockMinio.bucketExists.mockResolvedValue(false);
      mockBucketRepo.remove.mockResolvedValue({});

      await service.deleteBucket('user-1', 'my-bucket');

      expect(mockMinio.deleteBucket).not.toHaveBeenCalled();
    });

    it('removes DB record after successful MinIO deletion', async () => {
      mockBucketRepo.findOne.mockResolvedValue(bucket());
      mockFileRepo.count.mockResolvedValue(0);
      mockMinio.bucketExists.mockResolvedValue(true);
      mockBucketRepo.remove.mockResolvedValue({});

      await service.deleteBucket('user-1', 'my-bucket');

      expect(mockBucketRepo.remove).toHaveBeenCalled();
    });
  });

  describe('listBuckets', () => {
    it('returns paginated results for user', async () => {
      mockBucketRepo.findAndCount.mockResolvedValue([[bucket(), bucket()], 2]);

      const result = await service.listBuckets('user-1', 1, 50);

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
    });

    it('returns empty list when user has no buckets', async () => {
      mockBucketRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.listBuckets('user-1');

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });
});
