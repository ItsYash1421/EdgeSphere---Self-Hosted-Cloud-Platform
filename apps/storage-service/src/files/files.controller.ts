import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, Res, HttpCode, HttpStatus, Optional } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Response } from 'express';

@Controller('storage/buckets/:bucket')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('files')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Request() req,
    @Param('bucket') bucket: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('key') key?: string
  ) {
    return this.filesService.uploadFile(req.user.sub, bucket, file, key);
  }

  @UseGuards(JwtAuthGuard)
  @Get('files')
  listFiles(
    @Request() req,
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number
  ) {
    return this.filesService.listFiles(req.user.sub, bucket, prefix, page || 1, pageSize || 50);
  }

  // Download is intentionally unauthenticated at the guard level.
  // The FilesService checks bucket.isPublic — if the bucket is public,
  // the file is served freely (CDN uses this). If private, the service
  // will throw ForbiddenException unless a valid user owns it.
  @Get('files/:key')
  async downloadFile(
    @Request() req,
    @Param('bucket') bucket: string,
    @Param('key') key: string,
    @Query('version') version: string,
    @Res() res: Response
  ) {
    const parsedVersion = version ? parseInt(version, 10) : undefined;
    // req.user is set only if a valid JWT was present (via optional auth check in middleware)
    // Pass null for anonymous access — FilesService allows it for public buckets
    const userId = req.user?.sub || null;
    const { stream, contentType, size, etag } = await this.filesService.downloadFile(userId, bucket, key, parsedVersion);

    res.set({
      'Content-Type': contentType,
      'Content-Length': size,
      'ETag': etag,
      'Cache-Control': 'public, max-age=3600',
    });

    stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('files/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFile(
    @Request() req,
    @Param('bucket') bucket: string,
    @Param('key') key: string
  ) {
    return this.filesService.deleteFile(req.user.sub, bucket, key);
  }

  @UseGuards(JwtAuthGuard)
  @Post('presign')
  generatePresignedUrl(
    @Request() req,
    @Param('bucket') bucket: string,
    @Body() body: { key: string; expirySeconds: number; method: 'GET' | 'PUT' }
  ) {
    return this.filesService.generatePresignedUrl(req.user.sub, bucket, body.key, body.expirySeconds || 3600, body.method);
  }
}
