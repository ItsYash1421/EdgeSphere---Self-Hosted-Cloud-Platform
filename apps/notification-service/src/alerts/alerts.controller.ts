import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertRule } from './alert-rule';

@Controller('notifications/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('rules')
  listRules() {
    return this.alertsService.listRules();
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
  getAlertHistory() {
    return this.alertsService.getAlertHistory();
  }
}
