import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@pl-cms/shared';

export const ROLES_KEY = 'roles';

/** Decorator: @Roles(Role.ADMIN, Role.ADVISOR) */
export const Roles = (...roles: Role[]) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SetMetadata = require('@nestjs/common').SetMetadata;
  return SetMetadata(ROLES_KEY, roles);
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: { role: Role } }>();
    if (!user) throw new ForbiddenException();

    if (!required.includes(user.role)) throw new ForbiddenException();

    return true;
  }
}
