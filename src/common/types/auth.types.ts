import { UserRole } from '@prisma/client';

/** Shape attached to `request.user` after JWT authentication. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
