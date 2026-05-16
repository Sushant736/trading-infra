import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    @InjectDataSource() private db: DataSource,
  ) {}

  async loginSuperAdmin(email: string, password: string) {
    const [user] = await this.db.query(`SELECT * FROM super_admins WHERE email=$1 AND is_active=true`, [email]);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.db.query(`UPDATE super_admins SET last_login_at=NOW() WHERE id=$1`, [user.id]);
    const payload = { sub: user.id, email: user.email, role: 'SUPER_ADMIN' };
    return { access_token: this.jwtService.sign(payload), role: 'SUPER_ADMIN', user: { id: user.id, email: user.email, full_name: user.full_name } };
  }

  async loginFirmAdmin(email: string, password: string) {
    const [user] = await this.db.query(`SELECT * FROM firm_admins WHERE email=$1 AND is_active=true`, [email]);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.db.query(`UPDATE firm_admins SET last_login_at=NOW() WHERE id=$1`, [user.id]);
    const payload = { sub: user.id, email: user.email, role: 'FIRM_ADMIN', firm_id: user.firm_id };
    return { access_token: this.jwtService.sign(payload), role: 'FIRM_ADMIN', user: { id: user.id, email: user.email, full_name: user.full_name, firm_id: user.firm_id } };
  }

  async loginTrader(email: string, password: string, serverName: string) {
    const [firm] = await this.db.query(`SELECT * FROM firms WHERE server_name=$1 AND is_active=true`, [serverName.toUpperCase()]);
    if (!firm) throw new UnauthorizedException('Invalid server name');
    const [user] = await this.db.query(`SELECT * FROM traders WHERE email=$1 AND firm_id=$2 AND is_active=true`, [email, firm.id]);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const [rules] = await this.db.query(`SELECT * FROM firm_risk_rules WHERE firm_id=$1`, [firm.id]);
    const payload = { sub: user.id, email: user.email, role: 'TRADER', firm_id: firm.id, server: serverName.toUpperCase() };
    return {
      access_token: this.jwtService.sign(payload),
      role: 'TRADER',
      user: { id: user.id, email: user.email, full_name: user.full_name, firm_id: firm.id, server: serverName.toUpperCase() },
      firm: { id: firm.id, name: firm.name, server_name: firm.server_name },
      risk_rules: rules,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
