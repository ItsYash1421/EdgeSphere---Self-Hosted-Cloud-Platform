import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'yash@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MyStr0ng!Pass', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)  // bcrypt max input length
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'yash@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'MyStr0ng!Pass' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My Production Key' })
  @IsString()
  @MaxLength(100)
  name: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'Yash Kumar Meena', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
