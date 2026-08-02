import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;
  @Column() keyHash: string;
  @Column() keyPrefix: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) lastUsedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null;
}
