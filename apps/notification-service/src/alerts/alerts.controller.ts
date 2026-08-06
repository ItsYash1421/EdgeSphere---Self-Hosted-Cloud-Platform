import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertRule } from './alert-rule';

@Controller('notifications/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('rules')
  listRules(@Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    return this.alertsService.listRules(page || 1, pageSize || 20);
  }

  @Post('rules')
  createRule(@Body() rule: Partial<AlertRule>) {
    return this.alertsService.createRule(rule);
  }

  @Put('rules/:id')
  updateRule(@Param('id') id: string, @Body() updates: Partial<AlertRule>) {
    return this.alertsService.updateRule(id, updates);
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    this.alertsService.deleteRule(id);
    return { success: true };
  }

  @Get('history')
  getAlertHistory(@Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    return this.alertsService.getAlertHistory(page || 1, pageSize || 20);
  }
}
