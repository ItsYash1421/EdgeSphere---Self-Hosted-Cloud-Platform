import { Controller, Post, Put, Delete, Get, Body, Param, Req, Res, Headers, UseGuards } from '@nestjs/common';
import { MultipartService } from './multipart.service';
import { InitiateUploadDto, InitiateUploadResponse, UploadStatus } from './dto/multipart.dto';
import { Request, Response } from 'express';

@Controller('storage/multipart')
export class MultipartController {
  constructor(private readonly multipartService: MultipartService) {}

  @Post('initiate')
  async initiateUpload(
    @Req() req: any,
    @Body() dto: InitiateUploadDto
  ): Promise<InitiateUploadResponse> {
    const userId = req.user?.id || 'anonymous';
    return this.multipartService.initiateUpload(userId, dto.bucket, dto.key, dto.contentType, dto.totalSize);
  }

  @Put(':uploadId/parts/:partNumber')
  async uploadPart(
    @Param('uploadId') uploadId: string,
    @Param('partNumber') partNumber: string,
    @Req() req: Request
  ) {
    // Read raw body
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const result = await this.multipartService.uploadPart(uploadId, parseInt(partNumber, 10), buffer);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  @Post(':uploadId/complete')
  async completeUpload(
    @Param('uploadId') uploadId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id || 'anonymous';
    return this.multipartService.completeUpload(uploadId, userId);
  }

  @Delete(':uploadId')
  async abortUpload(
    @Param('uploadId') uploadId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id || 'anonymous';
    await this.multipartService.abortUpload(uploadId, userId);
    return { message: 'Upload aborted' };
  }

  @Get(':uploadId')
  async getUploadStatus(
    @Param('uploadId') uploadId: string,
    @Req() req: any
  ): Promise<UploadStatus> {
    const userId = req.user?.id || 'anonymous';
    return this.multipartService.getUploadStatus(uploadId, userId);
  }
}
