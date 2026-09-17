import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';

import {
  ALLOWED_IMAGE_MIME_TYPES,
  IMAGE_EXTENSION_BY_MIME_TYPE,
  type AllowedImageMimeType,
} from '../common/constants/allowed-image-mime-types.constant';
import { AppConfig } from '../config/configuration';

// Folders images may be uploaded into — kept as an allowlist (rather than
// trusting the raw :folder param) to rule out path traversal.
const ALLOWED_UPLOAD_FOLDERS = ['products', 'categories', 'hero', 'promo-banners'] as const;
export type UploadFolder = (typeof ALLOWED_UPLOAD_FOLDERS)[number];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Saves an uploaded image to local disk under uploads/<folder>/ (served
   * statically — see bootstrap.ts) and returns its public URL. Temporary
   * local-storage stand-in for the S3 presigned-upload flow in
   * StorageService, until S3 is actually wired up for this environment.
   */
  async uploadImage(folder: string, request: FastifyRequest): Promise<{ url: string }> {
    if (!ALLOWED_UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
      throw new BadRequestException(
        `Invalid upload folder. Allowed: ${ALLOWED_UPLOAD_FOLDERS.join(', ')}`,
      );
    }

    const file = await request.file();
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as AllowedImageMimeType)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }

    const buffer = await file.toBuffer();
    // @fastify/multipart truncates (rather than throwing) once the configured
    // fileSize limit is hit, so this has to be checked after buffering.
    if (file.file.truncated) {
      throw new BadRequestException('Image is too large');
    }

    const extension = IMAGE_EXTENSION_BY_MIME_TYPE[file.mimetype as AllowedImageMimeType];
    const filename = `${randomUUID()}${extension}`;
    const dir = join(process.cwd(), 'uploads', folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);

    const appUrl = this.configService.get<AppConfig>('app')!.appUrl;
    return { url: `${appUrl.replace(/\/$/, '')}/uploads/${folder}/${filename}` };
  }

  /**
   * Best-effort delete of a previously-uploaded file, given its public URL.
   * Silently ignores anything that isn't one of our own local uploads (e.g.
   * seed/placeholder URLs) and already-missing files, so callers can pass any
   * stored image URL — old or new, ours or not — without checking first.
   */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    if (!url) return;

    const appUrl = this.configService.get<AppConfig>('app')!.appUrl.replace(/\/$/, '');
    const prefix = `${appUrl}/uploads/`;
    if (!url.startsWith(prefix)) return;

    const [folder, filename, ...rest] = url.slice(prefix.length).split('/');
    if (
      !folder ||
      !filename ||
      rest.length > 0 ||
      !ALLOWED_UPLOAD_FOLDERS.includes(folder as UploadFolder)
    ) {
      return;
    }

    const filePath = join(process.cwd(), 'uploads', folder, filename);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to delete upload at ${filePath}: ${(error as Error).message}`);
      }
    }
  }

  async deleteManyByUrls(urls: Array<string | null | undefined>): Promise<void> {
    await Promise.all(urls.map((url) => this.deleteByUrl(url)));
  }
}
