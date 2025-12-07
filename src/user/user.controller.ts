import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';

class SignupDto {
  displayName?: string;
}

class LoginDto {
  token: string;
}

@ApiTags('Auth')
@Controller('auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('signup')
  @ApiOperation({ summary: 'Signup', description: 'Issue a 10-character API token for the user.' })
  async signup(@Body() dto: SignupDto) {
    return this.userService.signup(dto.displayName);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login', description: 'Validate an API token and return the user.' })
  async login(@Body() dto: LoginDto) {
    const user = await this.userService.validateToken(dto.token);
    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    return { userId: user.id, token: user.token, displayName: user.displayName };
  }
}
