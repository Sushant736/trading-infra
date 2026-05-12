import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength } from 'class-validator';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('super-admin/login')
  loginSuperAdmin(@Body() dto: LoginDto) {
    return this.authService.loginSuperAdmin(dto.email, dto.password);
  }

  @Post('firm-admin/login')
  loginFirmAdmin(@Body() dto: LoginDto) {
    return this.authService.loginFirmAdmin(dto.email, dto.password);
  }

  @Post('trader/login')
  loginTrader(@Body() dto: LoginDto) {
    return this.authService.loginTrader(dto.email, dto.password);
  }
}
