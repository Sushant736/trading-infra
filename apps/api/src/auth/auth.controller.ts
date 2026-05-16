import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('super-admin/login')
  loginSuperAdmin(@Body() body: any) {
    return this.authService.loginSuperAdmin(body.email, body.password);
  }

  @Post('firm-admin/login')
  loginFirmAdmin(@Body() body: any) {
    return this.authService.loginFirmAdmin(body.email, body.password);
  }

  @Post('trader/login')
  loginTrader(@Body() body: any) {
    return this.authService.loginTrader(body.email, body.password, body.server);
  }
}
