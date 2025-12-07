import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';

@Injectable()
export class TokenAuthGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice(7).trim();
    const user = await this.userService.validateToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }

    req.user = user; // attach for downstream handlers
    return true;
  }
}
