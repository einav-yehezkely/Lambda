import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { Topic } from '@lambda/shared';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';

@Injectable()
export class TopicsService {
  private get db() {
    return getSupabaseClient();
  }

  async listByVersion(versionId: string): Promise<Topic[]> {
    const { data, error } = await this.db
      .from('topics')
      .select('*')
      .eq('version_id', versionId)
      .order('order_index', { ascending: true });

    if (error) throw new InternalServerErrorException(error.message);
    return data as Topic[];
  }

  async getTopic(id: string): Promise<Topic> {
    const { data, error } = await this.db
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Topic not found');
    return data as Topic;
  }

  async createTopic(dto: CreateTopicDto, userId: string, isAdmin = false): Promise<Topic> {
    if (!isAdmin) await this.assertVersionAuthor(dto.version_id, userId);

    const { data, error } = await this.db
      .from('topics')
      .insert(dto)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data as Topic;
  }

  async updateTopic(id: string, dto: UpdateTopicDto, userId: string, isAdmin = false): Promise<Topic> {
    const topic = await this.getTopic(id);
    if (!isAdmin) await this.assertVersionAuthor(topic.version_id, userId);

    const { data, error } = await this.db
      .from('topics')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data as Topic;
  }

  async deleteTopic(id: string, userId: string, isAdmin = false): Promise<void> {
    const topic = await this.getTopic(id);
    if (!isAdmin) await this.assertVersionAuthor(topic.version_id, userId);

    const { error } = await this.db.from('topics').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  private async assertVersionAuthor(versionId: string, userId: string): Promise<void> {
    const { data, error } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', versionId)
      .single();

    if (error || !data) throw new NotFoundException('Version not found');
    if (data.author_id !== userId) {
      throw new ForbiddenException('Only the version author can modify its topics');
    }
  }
}
