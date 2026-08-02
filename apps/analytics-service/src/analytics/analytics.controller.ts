import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TimeSeriesPoint, SummaryStats } from './dto/analytics.dto';
import { RequestEventEntity } from './request-event.entity';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get total stats summary' })
  async getSummaryStats(@Query('window', new DefaultValuePipe(1440), ParseIntPipe) window: number): Promise<SummaryStats> {
    return this.analyticsService.getSummaryStats(window);
  }

  @Get('requests/rate')
  @ApiOperation({ summary: 'Get requests per second over time window' })
  async getRequestRate(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number): Promise<TimeSeriesPoint[]> {
    return this.analyticsService.getRequestRate(window);
  }

  @Get('requests/top-paths')
  @ApiOperation({ summary: 'Get top N paths by request count' })
  async getTopPaths(
    @Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.getTopPaths(limit, window);
  }

  @Get('requests/by-service')
  @ApiOperation({ summary: 'Get requests by service' })
  async getRequestsByService(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getRequestsByService(window);
  }

  @Get('cache/ratio')
  @ApiOperation({ summary: 'Get cache hit ratio' })
  async getCacheHitRatio(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getCacheHitRatio(window);
  }

  @Get('cache/ratio/timeseries')
  @ApiOperation({ summary: 'Get cache hit ratio percentage over time' })
  async getCacheHitRatioTimeSeries(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number): Promise<TimeSeriesPoint[]> {
    return this.analyticsService.getCacheHitRatioTimeSeries(window);
  }

  @Get('edges')
  @ApiOperation({ summary: 'Get per-edge-region request stats' })
  async getEdgeStats(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getEdgeStats(window);
  }

  @Get('latency/percentiles')
  @ApiOperation({ summary: 'Get P50/P95/P99 latency percentiles' })
  async getLatencyPercentiles(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getLatencyPercentiles(window);
  }

  @Get('bandwidth')
  @ApiOperation({ summary: 'Get bandwidth usage over time' })
  async getBandwidthOverTime(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number): Promise<TimeSeriesPoint[]> {
    return this.analyticsService.getBandwidthOverTime(window);
  }

  @Get('errors')
  @ApiOperation({ summary: 'Get error rate' })
  async getErrorRate(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getErrorRate(window);
  }

  @Get('geo')
  @ApiOperation({ summary: 'Get geographic distribution' })
  async getGeoDistribution(@Query('window', new DefaultValuePipe(60), ParseIntPipe) window: number) {
    return this.analyticsService.getGeoDistribution(window);
  }

  @Get('users/active')
  @ApiOperation({ summary: 'Get active users count' })
  async getActiveUsers(@Query('window', new DefaultValuePipe(15), ParseIntPipe) window: number): Promise<{ activeUsers: number }> {
    const activeUsers = await this.analyticsService.getActiveUsers(window);
    return { activeUsers };
  }

  @Get('events/recent')
  @ApiOperation({ summary: 'Get real-time events' })
  async getRecentEvents(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number): Promise<RequestEventEntity[]> {
    return this.analyticsService.getRecentEvents(limit);
  }

  @Get('events/search')
  @ApiOperation({ summary: 'Search request logs with filters and pagination' })
  async searchEvents(
    @Query('method') method?: string,
    @Query('service') service?: string,
    @Query('status') status?: '2xx' | '3xx' | '4xx' | '5xx',
    @Query('q') q?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.analyticsService.searchEvents({ method, service, statusClass: status, query: q, limit, offset });
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  health() {
    return { status: 'ok' };
  }
}