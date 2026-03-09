import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
  aud: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('SUPABASE_JWT_SECRET'),
      audience: 'authenticated',
    });
  }

  async validate(payload: SupabaseJwtPayload) {
    return this.usersService.findOrCreate({
      id: payload.sub,
      email: payload.email,
      display_name:
        payload.user_metadata?.full_name ??
        payload.user_metadata?.name ??
        null,
      avatar_url: payload.user_metadata?.avatar_url ?? null,
    });
  }
}
