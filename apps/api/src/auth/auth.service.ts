import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { SuperAdmin } from '../users/super-admin.entity';
import { FirmAdmin } from '../firms/firm-admin.entity';
import { Trader } from '../traders/trader.entity';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(SuperAdmin)
    private superAdminRepo: Repository<SuperAdmin>,
    @InjectRepository(FirmAdmin)
    private firmAdminRepo: Repository<FirmAdmin>,
    @InjectRepository(Trader)
    private traderRepo: Repository<Trader>,
  ) {}

  async loginSuperAdmin(email: string, password: string) {
    const user = await this.superAdminRepo.findOne({ where: { email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.superAdminRepo.update(user.id, { last_login_at: new Date() });
    const payload = { sub: user.id, email: user.email, role: 'SUPER_ADMIN' };
    return { access_token: this.jwtService.sign(payload), role: 'SUPER_ADMIN', user: { id: user.id, email: user.email, full_name: user.full_name } };
  }

  async loginFirmAdmin(email: string, password: string) {
    const user = await this.firmAdminRepo.findOne({ where: { email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.firmAdminRepo.update(user.id, { last_login_at: new Date() });
    const payload = { sub: user.id, email: user.email, role: 'FIRM_ADMIN', firm_id: user.firm_id };
    return { access_token: this.jwtService.sign(payload), role: 'FIRM_ADMIN', user: { id: user.id, email: user.email, full_name: user.full_name, firm_id: user.firm_id } };
  }

  async loginTrader(email: string, password: string) {
    const user = await this.traderRepo.findOne({ where: { email } });
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user.id, email: user.email, role: 'TRADER', firm_id: user.firm_id };
    return { access_token: this.jwtService.sign(payload), role: 'TRADER', user: { id: user.id, email: user.email, full_name: user.full_name, firm_id: user.firm_id } };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
