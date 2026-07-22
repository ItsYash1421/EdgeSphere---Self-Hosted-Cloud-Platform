import { IsString, IsNumber, Min } from 'class-validator';

export class InitiateUploadDto {
  @IsString() bucket: string;
  @IsString() key: string;
  @IsString() contentType: string;
  @IsNumber() @Min(1) totalSize: number;
}

export class InitiateUploadResponse {
  uploadId: string;
  partCount: number;
  partSize: number; // 5MB in bytes
  expiresAt: Date;
}

export class UploadStatus {
  uploadId: string;
  key: string;
  totalSize: number;
  completedParts: number;
  totalParts: number;
  progress: number; // 0-100
  expiresAt: Date;
  status: 'in_progress' | 'completed' | 'aborted';
}
