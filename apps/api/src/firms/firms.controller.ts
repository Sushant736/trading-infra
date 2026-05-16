import { Controller, Get, Post, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { FirmsService } from './firms.service';

@Controller('firms')
export class FirmsController {
  constructor(private firmsService: FirmsService) {}

  @Get()
  getAllFirms() { return this.firmsService.getAllFirms(); }

  @Get('stats')
  getStats() { return this.firmsService.getStats(); }

  @Get(':id')
  getFirm(@Param('id') id: string) { return this.firmsService.getFirm(id); }

  @Get(':id/traders')
  getFirmTraders(@Param('id') id: string) { return this.firmsService.getFirmTraders(id); }

  @Post()
  createFirm(@Body() body: any) { return this.firmsService.createFirm(body); }

  @Patch(':id')
  updateFirm(@Param('id') id: string, @Body() body: any) { return this.firmsService.updateFirm(id, body); }

  @Post(':id/admins')
  createFirmAdmin(@Param('id') id: string, @Body() body: any) { return this.firmsService.createFirmAdmin(id, body); }

  @Post(':id/traders')
  createTrader(@Param('id') id: string, @Body() body: any) { return this.firmsService.createTrader(id, body); }

  @Delete(':id')
  deactivateFirm(@Param('id') id: string) { return this.firmsService.deactivateFirm(id); }
}
