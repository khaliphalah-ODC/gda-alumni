import { Role } from '@prisma/client';

export interface JwtPayload {
  sessionVersion?: number;
  userId: string;
  role: Role;
}

export interface AuthenticatedUser extends JwtPayload {}
