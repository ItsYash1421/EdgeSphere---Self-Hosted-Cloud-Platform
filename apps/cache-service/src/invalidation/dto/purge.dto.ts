import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PurgeFileDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  key: string;
}

export class PurgeBucketDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;
}

export class PurgePrefixDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  prefix: string;
}
