import { Entity, Column } from 'typeorm';

@Entity('request_events')
export class RequestEventEntity {
  @Column({ type: 'timestamptz', primary: true })
  time: Date;

  @Column({ nullable: true }) service: string;
  @Column({ nullable: true }) method: string;
  @Column({ nullable: true }) path: string;
  @Column({ type: 'smallint', nullable: true }) status: number;
  @Column({ name: 'latency_ms', type: 'integer', nullable: true }) latencyMs: number;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string;
  @Column({ type: 'inet', nullable: true }) ip: string;
  @Column({ type: 'char', length: 2, nullable: true }) country: string;
  @Column({ name: 'cache_hit', default: false }) cacheHit: boolean;
  @Column({ type: 'bigint', default: 0 }) bytes: number;
  @Column({ name: 'edge_region', nullable: true }) edgeRegion: string;
  @Column({ name: 'request_id', type: 'uuid', generated: 'uuid' }) requestId: string;
}