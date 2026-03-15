import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { VersionFile } from '@lambda/shared';

const BUCKET = 'version-files';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES_PER_VERSION = 20;

@Injectable()
export class VersionFilesService {
  private get db() {
    return getSupabaseClient();
  }

  async list(versionId: string): Promise<VersionFile[]> {
    const { data, error } = await this.db
      .from('version_files')
      .select('*')
      .eq('version_id', versionId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as VersionFile[];
  }

  async upload(
    versionId: string,
    file: { buffer: Buffer; originalname: string; size: number; mimetype: string },
    displayName: string,
    userId: string,
  ): Promise<VersionFile> {
    // Verify version exists and user is the author
    const { data: version, error: vErr } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', versionId)
      .single();

    if (vErr || !version) throw new NotFoundException('Version not found');
    if (version.author_id !== userId) {
      throw new ForbiddenException('Only the version author can upload files');
    }

    // Validate file
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`File size exceeds 5 MB limit`);
    }

    // Check file count limit
    const { count, error: countErr } = await this.db
      .from('version_files')
      .select('id', { count: 'exact', head: true })
      .eq('version_id', versionId);

    if (countErr) throw new InternalServerErrorException(countErr.message);
    if ((count ?? 0) >= MAX_FILES_PER_VERSION) {
      throw new BadRequestException(`Maximum ${MAX_FILES_PER_VERSION} files per version`);
    }

    // Generate unique storage path: {versionId}/{uuid}
    const fileId = crypto.randomUUID();
    const storagePath = `${versionId}/${fileId}`;

    // Upload to Supabase Storage
    const { error: storageErr } = await this.db.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: 'application/pdf', upsert: false });

    if (storageErr) throw new InternalServerErrorException(storageErr.message);

    // Insert DB row
    const resolvedDisplayName = displayName?.trim() || file.originalname.replace(/\.pdf$/i, '');
    const { data: row, error: dbErr } = await this.db
      .from('version_files')
      .insert({
        version_id: versionId,
        original_filename: file.originalname,
        display_name: resolvedDisplayName,
        storage_path: storagePath,
        size_bytes: file.size,
      })
      .select()
      .single();

    if (dbErr) {
      // Rollback storage upload on DB failure
      await this.db.storage.from(BUCKET).remove([storagePath]);
      throw new InternalServerErrorException(dbErr.message);
    }

    return row as VersionFile;
  }

  async rename(fileId: string, displayName: string, userId: string): Promise<VersionFile> {
    const { data: file, error } = await this.db
      .from('version_files')
      .select('version_id')
      .eq('id', fileId)
      .single();

    if (error || !file) throw new NotFoundException('File not found');

    const { data: version, error: vErr } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', file.version_id)
      .single();

    if (vErr || !version) throw new NotFoundException('Version not found');
    if (version.author_id !== userId) {
      throw new ForbiddenException('Only the version author can rename files');
    }

    const { data: updated, error: upErr } = await this.db
      .from('version_files')
      .update({ display_name: displayName.trim() })
      .eq('id', fileId)
      .select()
      .single();

    if (upErr || !updated) throw new InternalServerErrorException(upErr?.message);
    return updated as VersionFile;
  }

  async remove(fileId: string, userId: string): Promise<void> {
    const { data: file, error } = await this.db
      .from('version_files')
      .select('storage_path, version_id')
      .eq('id', fileId)
      .single();

    if (error || !file) throw new NotFoundException('File not found');

    // Verify user is version author
    const { data: version, error: vErr } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', file.version_id)
      .single();

    if (vErr || !version) throw new NotFoundException('Version not found');
    if (version.author_id !== userId) {
      throw new ForbiddenException('Only the version author can delete files');
    }

    // Delete from storage first, then DB
    const { error: storageErr } = await this.db.storage
      .from(BUCKET)
      .remove([file.storage_path]);

    if (storageErr) throw new InternalServerErrorException(storageErr.message);

    await this.db.from('version_files').delete().eq('id', fileId);
  }

  async getSignedUrl(fileId: string, download: boolean): Promise<{ url: string }> {
    const { data: file, error } = await this.db
      .from('version_files')
      .select('storage_path, original_filename')
      .eq('id', fileId)
      .single();

    if (error || !file) throw new NotFoundException('File not found');

    const options = download ? { download: file.original_filename } : undefined;
    const { data, error: urlErr } = await this.db.storage
      .from(BUCKET)
      .createSignedUrl(file.storage_path, 3600, options);

    if (urlErr || !data?.signedUrl) {
      throw new InternalServerErrorException(urlErr?.message ?? 'Failed to generate URL');
    }

    return { url: data.signedUrl };
  }

  /** Called by CoursesService before deleting a version, to purge storage. */
  async deleteAllForVersion(versionId: string): Promise<void> {
    const { data: files } = await this.db
      .from('version_files')
      .select('storage_path')
      .eq('version_id', versionId);

    if (files && files.length > 0) {
      await this.db.storage
        .from(BUCKET)
        .remove(files.map((f: any) => f.storage_path));
    }
  }
}
