import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthService } from './auth.service';

/**
 * Authenticates a request from its `Authorization: Bearer <access token>`
 * header and attaches the resolved user to `request.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    protected readonly auth: AuthService,
    protected readonly prisma: PrismaService,
  ) {}

  protected extractToken(request: any): string | null {
    const header = request.headers?.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
  }

  protected async resolveUser(request: any) {
    const token = this.extractToken(request);
    if (!token) return null;

    const payload = await this.auth.verifyAccessToken(token);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // Token is validly signed but the account is gone.
    if (!user) throw new UnauthorizedException('Account no longer exists.');

    return user;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.resolveUser(request);
    if (!user) throw new UnauthorizedException('Authentication required.');
    request.user = user;
    return true;
  }
}

/**
 * Lets anonymous callers through with `request.user === null`, so a handler can
 * vary its response for signed-in users without requiring a token.
 */
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    try {
      request.user = await this.resolveUser(request);
    } catch {
      request.user = null;
    }
    return true;
  }
}
