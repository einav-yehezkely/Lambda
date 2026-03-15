import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { CourseTemplate, CourseVersion, Topic } from '@lambda/shared';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

@Injectable()
export class CoursesService {
  private get db() {
    return getSupabaseClient();
  }

  // ─── Course Templates ───────────────────────────────────────────────────────

  async getSubjects(): Promise<string[]> {
    const { data, error } = await this.db
      .from('course_templates')
      .select('subject');
    if (error) throw new InternalServerErrorException(error.message);
    const subjects = [...new Set((data ?? []).map((r: any) => r.subject).filter(Boolean))];
    return subjects.sort();
  }

  async listCourses(filters: {
    subject?: string;
    search?: string;
    sort?: 'popular' | 'recent';
  }): Promise<CourseTemplate[]> {
    let query = this.db.from('course_templates').select('*');

    if (filters.subject) {
      query = query.eq('subject', filters.subject);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;

      // Find template_ids from versions whose institution matches
      const { data: matchingVersions } = await this.db
        .from('course_versions')
        .select('template_id')
        .ilike('institution', term);

      // Find template_ids from versions that contain matching content items
      const { data: matchingItems } = await this.db
        .from('content_items')
        .select('id')
        .or(`title.ilike.${term},content.ilike.${term}`);
      const itemIds = (matchingItems ?? []).map((i: any) => i.id);

      let contentTemplateIds: string[] = [];
      if (itemIds.length > 0) {
        const { data: vci } = await this.db
          .from('version_content_items')
          .select('version_id')
          .in('content_item_id', itemIds);
        const versionIds = [...new Set((vci ?? []).map((r: any) => r.version_id))];
        if (versionIds.length > 0) {
          const { data: versionsFromContent } = await this.db
            .from('course_versions')
            .select('template_id')
            .in('id', versionIds);
          contentTemplateIds = [...new Set((versionsFromContent ?? []).map((v: any) => v.template_id))];
        }
      }

      const extraIds = [...new Set([
        ...(matchingVersions ?? []).map((v: any) => v.template_id),
        ...contentTemplateIds,
      ])];

      if (extraIds.length > 0) {
        query = query.or(
          `title.ilike.${term},description.ilike.${term},id.in.(${extraIds.join(',')})`,
        );
      } else {
        query = query.or(`title.ilike.${term},description.ilike.${term}`);
      }
    }
    if (filters.sort === 'recent') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('title', { ascending: true });
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);
    return data as CourseTemplate[];
  }

  async getCourse(id: string): Promise<CourseTemplate> {
    const { data, error } = await this.db
      .from('course_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Course not found');
    return data as CourseTemplate;
  }

  async createCourse(dto: CreateCourseDto, userId: string): Promise<CourseTemplate> {
    const { data, error } = await this.db
      .from('course_templates')
      .insert({ ...dto, created_by: userId })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data as CourseTemplate;
  }

  // ─── Course Versions ────────────────────────────────────────────────────────

  async listVersions(templateId: string): Promise<CourseVersion[]> {
    const { data, error } = await this.db
      .from('course_versions')
      .select('*, author:users!course_versions_author_id_fkey(username, display_name, avatar_url)')
      .eq('template_id', templateId)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data as CourseVersion[];
  }

  async getVersion(id: string): Promise<CourseVersion> {
    const { data, error } = await this.db
      .from('course_versions')
      .select('*, author:users!course_versions_author_id_fkey(username, display_name, avatar_url)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Version not found');
    return data as CourseVersion;
  }

  async createVersion(dto: CreateVersionDto, userId: string): Promise<CourseVersion> {
    const { based_on_version_id, ...rest } = dto;

    const { data, error } = await this.db
      .from('course_versions')
      .insert({
        ...rest,
        author_id: userId,
        based_on_version_id: based_on_version_id ?? null,
        visibility: dto.visibility ?? 'public',
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    const newVersion = data as CourseVersion;

    // If forking, copy topics and content references
    if (based_on_version_id) {
      await this.forkTopicsAndContent(based_on_version_id, newVersion.id);
    }

    return newVersion;
  }

  async updateVersion(id: string, dto: UpdateVersionDto, userId: string, isAdmin = false): Promise<CourseVersion> {
    const version = await this.getVersion(id);
    if (!isAdmin && version.author_id !== userId) {
      throw new ForbiddenException('Only the author can edit this version');
    }

    const { data, error } = await this.db
      .from('course_versions')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data as CourseVersion;
  }

  async deleteVersion(id: string, userId: string, isAdmin = false): Promise<void> {
    const version = await this.getVersion(id);
    if (!isAdmin && version.author_id !== userId) {
      throw new ForbiddenException('Only the author can delete this version');
    }

    // Re-parent any forks that point to this version
    const { error: reparentError } = await this.db
      .from('course_versions')
      .update({ based_on_version_id: version.based_on_version_id ?? null })
      .eq('based_on_version_id', id);
    if (reparentError) throw new InternalServerErrorException(reparentError.message);

    const { error } = await this.db.from('course_versions').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async deleteCourse(id: string, userId: string, isAdmin = false): Promise<void> {
    const course = await this.getCourse(id);
    if (!isAdmin && course.created_by !== userId) {
      throw new ForbiddenException('Only the creator can delete this course');
    }
    const { error } = await this.db.from('course_templates').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Fork Logic ─────────────────────────────────────────────────────────────
  //
  // When forking version A → version B:
  //   1. Copy topic rows (new IDs, new version_id), keep a mapping old → new
  //   2. Copy version_content_items rows, replacing topic_id using the mapping

  private async forkTopicsAndContent(sourceVersionId: string, newVersionId: string): Promise<void> {
    // 1. Load source topics
    const { data: sourceTopics, error: topicsError } = await this.db
      .from('topics')
      .select('*')
      .eq('version_id', sourceVersionId)
      .order('order_index', { ascending: true });

    if (topicsError) throw new InternalServerErrorException(topicsError.message);
    if (!sourceTopics || sourceTopics.length === 0) return;

    // 2. Insert new topic rows, collect old_id → new_id mapping
    const topicIdMap = new Map<string, string>();

    for (const topic of sourceTopics as Topic[]) {
      const { data: newTopic, error } = await this.db
        .from('topics')
        .insert({
          version_id: newVersionId,
          title: topic.title,
          description: topic.description,
          order_index: topic.order_index,
        })
        .select('id')
        .single();

      if (error) throw new InternalServerErrorException(error.message);
      topicIdMap.set(topic.id, newTopic.id);
    }

    // 3. Load source junction rows
    const { data: sourceJunction, error: junctionError } = await this.db
      .from('version_content_items')
      .select('content_item_id, topic_id')
      .eq('version_id', sourceVersionId);

    if (junctionError) throw new InternalServerErrorException(junctionError.message);
    if (!sourceJunction || sourceJunction.length === 0) return;

    // 4. Insert new junction rows with remapped topic_ids
    const newJunctionRows = sourceJunction.map((row) => ({
      version_id: newVersionId,
      content_item_id: row.content_item_id,
      topic_id: row.topic_id ? (topicIdMap.get(row.topic_id) ?? null) : null,
    }));

    const { error: insertError } = await this.db
      .from('version_content_items')
      .insert(newJunctionRows);

    if (insertError) throw new InternalServerErrorException(insertError.message);
  }
}
