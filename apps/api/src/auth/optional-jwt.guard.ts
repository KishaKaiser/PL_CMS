import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Reads the sign-in when there is one, and lets the request through when there is not (or it has expired). For pages that
 * work for anyone but show more to the signed-in customer, such as order tracking.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_error: unknown, user: TUser | false | null): TUser | null {
    return user || null;
  }
}
