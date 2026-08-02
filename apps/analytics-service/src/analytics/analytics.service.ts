import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestEventEntity } from './request-event.entity';
import { RequestEventDto, TimeSeriesPoint, SummaryStats } from './dto/analytics.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(RequestEventEntity)
    private readonly repository: Repository<RequestEventEntity>,
  ) {}

  async ingestEvent(event: RequestEventDto): Promise<void> {
    await this.ingestEventBatch([event]);
  }

  async ingestEventBatch(events: RequestEventDto[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const entities = events.map(event => ({
        time: event.time ? new Date(event.time) : new Date(),
        service: event.service,
        method: event.method,
        path: event.path,
        status: event.status,
        latencyMs: event.latencyMs,
        userId: event.userId,
        ip: event.ip,
        country: event.country,
        cacheHit: event.cacheHit || false,
        bytes: event.bytes || 0,
        edgeRegion: event.edgeRegion,
        requestId: event.requestId || uuidv4(),
      }));

      await this.repository
        .createQueryBuilder()
        .insert()
        .into(RequestEventEntity)
        .values(entities)
        .execute();
        
      this.logger.debug(`Ingested ${events.length} events`);
    } catch (error) {
      this.logger.error('Error inserting events into database', error);
    }
  }

  async getRequestRate(windowMinutes: number = 60): Promise<TimeSeriesPoint[]> {
    const query = `
      SELECT time_bucket('1 minute', time) AS t, COUNT(*) AS value
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
      GROUP BY t ORDER BY t ASC
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({ t: row.t, value: parseInt(row.value, 10) }));
  }

  async getCacheHitRatio(windowMinutes: number = 60): Promise<{ hitRatio: number; hits: number; misses: number; cachedBytes: number }> {
    const query = `
      SELECT
        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::integer as hits,
        COUNT(*)::integer as total,
        SUM(bytes) FILTER (WHERE cache_hit)::bigint as cached_bytes
      FROM request_events
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
    `;
    const result = await this.repository.query(query);
    const hits = parseInt(result[0].hits || '0', 10);
    const total = parseInt(result[0].total || '0', 10);
    const misses = total - hits;
    const hitRatio = total > 0 ? hits / total : 0;
    const cachedBytes = parseInt(result[0].cached_bytes || '0', 10);

    return { hitRatio, hits, misses, cachedBytes };
  }

  async getLatencyPercentiles(windowMinutes: number = 60): Promise<{ p50: number; p95: number; p99: number }> {
    const query = `
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
    `;
    const result = await this.repository.query(query);
    return {
      p50: parseFloat(result[0].p50 || '0'),
      p95: parseFloat(result[0].p95 || '0'),
      p99: parseFloat(result[0].p99 || '0'),
    };
  }

  async getBandwidthOverTime(windowMinutes: number = 60): Promise<TimeSeriesPoint[]> {
    const query = `
      SELECT time_bucket('1 minute', time) AS t, SUM(bytes)::bigint AS value
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
      GROUP BY t ORDER BY t
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({ t: row.t, value: parseInt(row.value || '0', 10) }));
  }

  async getErrorRate(windowMinutes: number = 60): Promise<{ errorRate: number; total: number; errors: number }> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE status >= 400)::integer as errors, 
        COUNT(*)::integer as total
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
    `;
    const result = await this.repository.query(query);
    const errors = parseInt(result[0].errors || '0', 10);
    const total = parseInt(result[0].total || '0', 10);
    const errorRate = total > 0 ? errors / total : 0;
    
    return { errorRate, total, errors };
  }

  async getTopPaths(limit: number = 10, windowMinutes: number = 60): Promise<{ path: string; count: number; avgLatency: number }[]> {
    const query = `
      SELECT path, COUNT(*)::integer as count, AVG(latency_ms) as avg_latency
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
      GROUP BY path ORDER BY count DESC LIMIT $1
    `;
    const result = await this.repository.query(query, [limit]);
    return result.map((row: any) => ({
      path: row.path,
      count: parseInt(row.count, 10),
      avgLatency: parseFloat(row.avg_latency || '0'),
    }));
  }

  async getGeoDistribution(windowMinutes: number = 60): Promise<{ country: string; count: number; pct: number }[]> {
    const query = `
      SELECT 
        country, 
        COUNT(*)::integer as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as pct
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes' AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT 20
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({
      country: row.country,
      count: parseInt(row.count, 10),
      pct: parseFloat(row.pct || '0'),
    }));
  }

  async getRequestsByService(windowMinutes: number = 60): Promise<{ service: string; count: number; errorCount: number }[]> {
    const query = `
      SELECT 
        service, 
        COUNT(*)::integer as count,
        COUNT(*) FILTER (WHERE status >= 400)::integer as error_count
      FROM request_events 
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes' AND service IS NOT NULL
      GROUP BY service ORDER BY count DESC
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({
      service: row.service,
      count: parseInt(row.count, 10),
      errorCount: parseInt(row.error_count, 10),
    }));
  }

  async getActiveUsers(windowMinutes: number = 15): Promise<number> {
    const query = `
      SELECT COUNT(DISTINCT user_id)::integer as count 
      FROM request_events
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes' AND user_id IS NOT NULL
    `;
    const result = await this.repository.query(query);
    return parseInt(result[0].count || '0', 10);
  }

  async getSummaryStats(windowMinutes: number = 1440): Promise<SummaryStats> {
    const [
      { total: totalRequests },
      { hitRatio: cacheHitRatio },
      { p95: p95Latency },
      errorData,
      activeUsers,
      totalBytesData,
      avgLatencyData
    ] = await Promise.all([
      this.getErrorRate(windowMinutes), // gives total requests
      this.getCacheHitRatio(windowMinutes),
      this.getLatencyPercentiles(windowMinutes),
      this.getErrorRate(windowMinutes),
      this.getActiveUsers(windowMinutes),
      this.repository.query(`SELECT SUM(bytes)::bigint as total FROM request_events WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'`),
      this.repository.query(`SELECT AVG(latency_ms) as avg FROM request_events WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'`),
    ]);

    return {
      totalRequests,
      cacheHitRatio,
      avgLatency: parseFloat(avgLatencyData[0]?.avg || '0'),
      p95Latency,
      totalBandwidthBytes: parseInt(totalBytesData[0]?.total || '0', 10),
      errorRate: errorData.errorRate,
      activeUsers,
      windowMinutes,
      generatedAt: new Date(),
    };
  }

  private mapEventRow(row: any): RequestEventEntity {
    return {
      time: row.time,
      service: row.service,
      method: row.method,
      path: row.path,
      status: row.status,
      latencyMs: row.latency_ms,
      userId: row.user_id,
      ip: row.ip,
      country: row.country,
      cacheHit: row.cache_hit,
      bytes: row.bytes,
      edgeRegion: row.edge_region,
      requestId: row.request_id,
    };
  }

  async getRecentEvents(limit: number = 50): Promise<RequestEventEntity[]> {
    const query = `SELECT * FROM request_events ORDER BY time DESC LIMIT $1`;
    const result = await this.repository.query(query, [limit]);
    return result.map((row: any) => this.mapEventRow(row));
  }

  async searchEvents(filters: {
    method?: string;
    service?: string;
    statusClass?: '2xx' | '3xx' | '4xx' | '5xx';
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: RequestEventEntity[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.method) {
      params.push(filters.method);
      conditions.push(`method = $${params.length}`);
    }
    if (filters.service) {
      params.push(filters.service);
      conditions.push(`service = $${params.length}`);
    }
    if (filters.statusClass) {
      const base = parseInt(filters.statusClass[0], 10) * 100;
      params.push(base, base + 100);
      conditions.push(`status >= $${params.length - 1} AND status < $${params.length}`);
    }
    if (filters.query) {
      params.push(`%${filters.query}%`);
      const p = params.length;
      conditions.push(`(path ILIKE $${p} OR ip::text ILIKE $${p} OR request_id::text ILIKE $${p})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const dataQuery = `SELECT * FROM request_events ${whereClause} ORDER BY time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countQuery = `SELECT COUNT(*)::integer as total FROM request_events ${whereClause}`;

    const [data, countResult] = await Promise.all([
      this.repository.query(dataQuery, [...params, limit, offset]),
      this.repository.query(countQuery, params),
    ]);

    return { data: data.map((row: any) => this.mapEventRow(row)), total: countResult[0]?.total ?? 0 };
  }

  async getCacheHitRatioTimeSeries(windowMinutes: number = 60): Promise<TimeSeriesPoint[]> {
    const query = `
      SELECT
        time_bucket('1 minute', time) AS t,
        ROUND(AVG(cache_hit::int) * 100)::integer AS value
      FROM request_events
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes'
      GROUP BY t ORDER BY t
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({ t: row.t, value: parseInt(row.value || '0', 10) }));
  }

  async getEdgeStats(windowMinutes: number = 60): Promise<{
    region: string;
    requests: number;
    cacheHitRatio: number;
    avgLatencyMs: number;
    lastSeen: string;
  }[]> {
    const query = `
      SELECT
        edge_region AS region,
        COUNT(*)::integer AS requests,
        ROUND(AVG(cache_hit::int), 4)::float AS cache_hit_ratio,
        AVG(latency_ms) AS avg_latency_ms,
        MAX(time) AS last_seen
      FROM request_events
      WHERE time > NOW() - INTERVAL '${windowMinutes} minutes' AND edge_region IS NOT NULL
      GROUP BY edge_region ORDER BY requests DESC
    `;
    const result = await this.repository.query(query);
    return result.map((row: any) => ({
      region: row.region,
      requests: parseInt(row.requests, 10),
      cacheHitRatio: parseFloat(row.cache_hit_ratio || '0'),
      avgLatencyMs: parseFloat(row.avg_latency_ms || '0'),
      lastSeen: row.last_seen,
    }));
  }
}