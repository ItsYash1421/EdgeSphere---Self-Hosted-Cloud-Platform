import { IsString, Matches, IsOptional, IsBoolean } from 'class-validator';

export class CreateBucketDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
  name: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
