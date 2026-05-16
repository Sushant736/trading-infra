import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { TradersService } from './traders.service';
import { JwtService } from '@nestjs/jwt';
import { ChallengesService } from '../firms/challenges.service';

@Controller('firm')
export class TradersController {
  constructor(
    private tradersService: TradersService,
    private jwtService: JwtService,
    private challengesService: ChallengesService,
  ) {}

  private getFirmFromToken(auth: string) {
    try {
      const token = auth?.replace('Bearer ', '');
      return this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'changeme_super_secret' });
    } catch { return null; }
  }

  @Get('dashboard')
  async getDashboard(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getFirmDashboard(admin.firm_id);
  }

  @Get('traders')
  async getTraders(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getFirmTraders(admin.firm_id);
  }

  @Get('traders/:id')
  async getTrader(@Param('id') id: string, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getTraderDetail(id, admin.firm_id);
  }

  @Post('traders')
  async createTrader(@Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.createTrader(admin.firm_id, body);
  }

  @Patch('traders/:id/toggle')
  async toggleTrader(@Param('id') id: string, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.toggleTrader(id, admin.firm_id);
  }

  @Get('risk-rules')
  async getRules(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getRiskRules(admin.firm_id);
  }

  @Patch('risk-rules')
  async updateRules(@Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.updateRiskRules(admin.firm_id, body);
  }

  @Get('risk-events')
  async getRiskEvents(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getRiskEvents(admin.firm_id);
  }

  @Get('webhook-info')
  async getWebhookInfo(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.tradersService.getWebhookInfo(admin.firm_id);
  }

  @Get('phases')
  async getPhases(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.getPhases(admin.firm_id);
  }

  @Post('phases')
  async createPhase(@Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.createPhase(admin.firm_id, body);
  }

  @Patch('phases/:id')
  async updatePhase(@Param('id') id: string, @Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.updatePhase(id, admin.firm_id, body);
  }

  @Delete('phases/:id')
  async deletePhase(@Param('id') id: string, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.deletePhase(id, admin.firm_id);
  }

  @Get('challenges')
  async getChallenges(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.getTraderChallenges(admin.firm_id);
  }

  @Post('challenges/assign')
  async assignChallenge(@Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.assignChallenge(admin.firm_id, body);
  }

  @Get('challenges/check')
  async checkProgress(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.challengesService.checkChallengeProgress(admin.firm_id);
  }
}
