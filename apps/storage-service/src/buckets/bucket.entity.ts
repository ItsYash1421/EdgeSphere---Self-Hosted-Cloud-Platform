import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('buckets')
export class BucketEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ unique: true }) name: string;
  @Column({ default: 'us-east-1' }) region: string;
  @Column({ default: false }) isPublic: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
