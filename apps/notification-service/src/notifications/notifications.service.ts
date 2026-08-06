import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { MetricsService } from '../metrics/metrics.service';

export interface NotificationRecord {
  id: string;
  alertId: string;
  channels: string[];
  status: 'success' | 'failed';
  timestamp: Date;
  error?: string;
}

export interface AlertWebhookPayload {
  alertId: string;
  ruleName: string;
  condition: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  severity: string;
}

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;
  private history: NotificationRecord[] = [];

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.ethereal.email',
      port: this.configService.get<number>('SMTP_PORT') || 587,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async dispatch(alert: any, channels: string[]): Promise<void> {
    const record: NotificationRecord = {
      id: Math.random().toString(36).substring(7),
      alertId: alert.id || 'unknown',
      channels,
      status: 'success',
      timestamp: new Date(),
    };

    try {
      for (const channel of channels) {
        try {
          if (channel === 'email') {
            await this.sendEmail(
              this.configService.get<string>('ALERT_EMAIL_TO') || 'admin@edgesphere.local',
              `Alert Triggered: ${alert.ruleName || alert.name}`,
              `Message: ${alert.message}\nCondition: ${alert.condition}\nValue: ${alert.currentValue}`,
            );
          } else if (channel === 'webhook') {
            await this.sendWebhook(
              this.configService.get<string>('WEBHOOK_URL') || 'http://localhost:3100/api/webhooks/alerts',
              {
                alertId: alert.id,
                ruleName: alert.ruleName || alert.name,
                condition: alert.condition,
                threshold: alert.threshold,
                currentValue: alert.currentValue,
                message: alert.message,
                timestamp: alert.timestamp || new Date(),
                severity: 'high',
              }
            );
          } else if (channel === 'slack') {
            const slackUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
            if (slackUrl) {
              await this.sendSlack(slackUrl, `*Alert*: ${alert.ruleName || alert.name}\n${alert.message}`);
            }
          }
          this.metricsService.notificationsSentTotal.labels(channel).inc();
        } catch (error: any) {
          this.metricsService.notificationsFailedTotal.labels(channel).inc();
          record.status = 'failed';
          record.error = error.message;
          console.error(`Failed to send notification via ${channel}:`, error);
        }
      }
    } finally {
      this.history.unshift(record);
      if (this.history.length > 100) {
        this.history.pop();
      }
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM') || 'alerts@edgesphere.local',
      to,
      subject,
      text: body,
    });
  }

  async sendWebhook(url: string, payload: AlertWebhookPayload): Promise<void> {
    await axios.post(url, payload);
  }

  async sendSlack(webhookUrl: string, message: string): Promise<void> {
    await axios.post(webhookUrl, {
      text: message,
      attachments: [{ color: 'danger', fields: [{ title: 'Alert', value: message }] }],
    });
  }

  getHistory(page = 1, pageSize = 20) {
    const total = this.history.length;
    const start = (page - 1) * pageSize;
    const data = this.history.slice(start, start + pageSize);
    return { data, total, page, pageSize };
  }
}
