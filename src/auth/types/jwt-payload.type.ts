import { UserRole } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  jti: string;
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
