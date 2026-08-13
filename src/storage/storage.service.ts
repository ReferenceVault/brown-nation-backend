import { randomUUID } from 'node:crypto';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { S3Config } from '../config/configuration';

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

/**
 * File storage abstraction over any S3-compatible provider (AWS S3,
 * Cloudflare R2, MinIO, ...). Only object keys/URLs are persisted in
 * PostgreSQL — binary content always lives in the object store.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly config: S3Config;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<S3Config>('s3')!;

    this.client = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint || undefined,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
    });
  }

  buildKey(folder: string, originalFilename: string): string {
    const extension = originalFilename.includes('.')
      ? originalFilename.slice(originalFilename.lastIndexOf('.'))
      : '';
    return `${folder}/${randomUUID()}${extension}`;
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicUrl.replace(/\/$/, '')}/${key}`;
  }

  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      key,
      uploadUrl,
      publicUrl: this.getPublicUrl(key),
      expiresInSeconds,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
