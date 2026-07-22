import { Controller, Get, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('history')
  getHistory() {
    return this.notificationsService.getHistory();
  }

  @Post('test')
  async testNotification(@Body() body: any) {
    const alert = {
      id: 'test-123',
      ruleName: 'Test Alert',
      condition: 'test',
      threshold: 0,
      currentValue: 1,
      message: 'This is a test notification',
      timestamp: new Date(),
    };
    await this.notificationsService.dispatch(alert, ['email', 'webhook', 'slack']);
    return { status: 'sent' };
  }
}
