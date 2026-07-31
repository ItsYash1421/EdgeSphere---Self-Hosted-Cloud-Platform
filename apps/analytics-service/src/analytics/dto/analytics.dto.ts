import { ApiProperty } from '@nestjs/swagger';

export class TimeSeriesPoint {
  @ApiProperty()
  t: string;

  @ApiProperty()
  value: number;
}

export class SummaryStats {
  @ApiProperty()
  totalRequests: number;

  @ApiProperty()
  cacheHitRatio: number;

  @ApiProperty()
  avgLatency: number;

  @ApiProperty()
  p95Latency: number;

  @ApiProperty()
  totalBandwidthBytes: number;

  @ApiProperty()
  errorRate: number;

  @ApiProperty()
  activeUsers: number;

  @ApiProperty()
  windowMinutes: number;

  @ApiProperty()
  generatedAt: Date;
}

export class RequestEventDto {
  time?: string | Date;
  service?: string;
  method?: string;
  path?: string;
  status?: number;
  latencyMs?: number;
  userId?: string;
  ip?: string;
  country?: string;
  cacheHit?: boolean;
  bytes?: number;
  edgeRegion?: string;
  requestId?: string;
}