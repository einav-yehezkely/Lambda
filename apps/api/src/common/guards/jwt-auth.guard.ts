import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getSupabaseClient } from '../supabase.client';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user: unknown;
    }>();

    const authorization = request.headers['authorization'];
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = authorization.slice(7);
    const { data: { user }, error } = await getSupabaseClient().auth.getUser(token);

    if (error || !user || !user.email) throw new UnauthorizedException();

    request.user = await this.usersService.findOrCreate({
      id: user.id,
      email: user.email,
      display_name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    });

    return true;
  }
}
