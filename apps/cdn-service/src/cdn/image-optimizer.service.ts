import { Injectable, Logger } from "@nestjs/common";
import * as sharp from "sharp";

export interface ImageTransformParams {
  w?: number;
  h?: number;
  fmt?: string;
  q?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface TransformResult {
  data: Buffer;
  contentType: string;
  originalSize: number;
  optimizedSize: number;
}

@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  async transform(buffer: Buffer, contentType: string, params: ImageTransformParams): Promise<TransformResult> {
    try {
      const originalSize = buffer.length;
      let pipeline = sharp(buffer);

      // Resize
      if (params.w || params.h) {
        pipeline = pipeline.resize({
          width: params.w ? parseInt(params.w as any, 10) : undefined,
          height: params.h ? parseInt(params.h as any, 10) : undefined,
          fit: params.fit || "cover",
        });
      }

      // Format & Quality
      let format = params.fmt;
      if (!format) {
        // Infer from content type or default to original
        if (contentType.includes("webp")) format = "webp";
        else if (contentType.includes("png")) format = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) format = "jpeg";
        else if (contentType.includes("avif")) format = "avif";
        else format = "jpeg";
      }

      const quality = params.q ? parseInt(params.q as any, 10) : 80;

      if (format === "webp") {
        pipeline = pipeline.webp({ quality });
        contentType = "image/webp";
      } else if (format === "avif") {
        pipeline = pipeline.avif({ quality });
        contentType = "image/avif";
      } else if (format === "png") {
        pipeline = pipeline.png({ quality });
        contentType = "image/png";
      } else if (format === "jpeg" || format === "jpg") {
        pipeline = pipeline.jpeg({ quality });
        contentType = "image/jpeg";
      }

      const data = await pipeline.toBuffer();
      const optimizedSize = data.length;

      return {
        data,
        contentType,
        originalSize,
        optimizedSize,
      };
    } catch (error) {
      this.logger.error("Error during image transformation", error);
      throw error;
    }
  }

  isImage(contentType: string): boolean {
    if (!contentType) return false;
    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/svg+xml"];
    return supportedTypes.includes(contentType.toLowerCase());
  }

  getSupportedFormats(): string[] {
    return ["jpeg", "png", "webp", "avif"];
  }
}
