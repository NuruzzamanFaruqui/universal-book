import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Headers('authorization') authorization: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authorization.replace('Bearer ', '');
    const user = await this.authService.loginOrRegister(token);

    return {
      message: 'Login successful',
      user,
    };
  }
}