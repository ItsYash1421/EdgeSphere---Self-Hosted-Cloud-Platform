import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() bucketId: string;
  @Column() key: string;
  @Column({ type: 'bigint' }) size: number;
  @Column() contentType: string;
  @Column({ nullable: true }) etag: string;
  @Column({ default: 1 }) version: number;
  @Column({ default: true }) isLatest: boolean;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, string>;
  @CreateDateColumn() createdAt: Date;
}
