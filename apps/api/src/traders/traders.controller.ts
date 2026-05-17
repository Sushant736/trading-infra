import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { TradersService } from './traders.service';
import { JwtService } from '@nestjs/jwt';
import { ChallengesService } from '../firms/challenges.service';
import { ProgramsService } from '../firms/programs.service';

@Controller('firm')
export class TradersController {
  constructor(
    private tradersService: TradersService,
    private jwtService: JwtService,
    private challengesService: ChallengesService,
    private programsService: ProgramsService,
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

  // Programs
  @Get('programs')
  async getPrograms(@Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.getPrograms(admin.firm_id);
  }

  @Post('programs')
  async createProgram(@Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.createProgram(admin.firm_id, body);
  }

  @Patch('programs/:id')
  async updateProgram(@Param('id') id: string, @Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.updateProgram(id, admin.firm_id, body);
  }

  @Delete('programs/:id')
  async deleteProgram(@Param('id') id: string, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.deleteProgram(id, admin.firm_id);
  }

  @Post('programs/:id/phases')
  async upsertPhase(@Param('id') id: string, @Body() body: any, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.upsertPhase(id, admin.firm_id, body);
  }

  @Delete('programs/:id/phases/:order')
  async deletePhase(@Param('id') id: string, @Param('order') order: string, @Headers('authorization') auth: string) {
    const admin = this.getFirmFromToken(auth);
    if (!admin) return { error: 'Unauthorized' };
    return this.programsService.deletePhase(id, parseInt(order));
  }
}
