import { Controller, Get, Res } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { Response } from "express";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set("Content-Type", this.metricsService.getContentType());
    res.send(metrics);
  }
}
