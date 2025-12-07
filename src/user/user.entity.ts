import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 10, unique: true })
  token: string; // 10-character API token issued at signup

  @Column({ nullable: true })
  displayName?: string;

  @CreateDateColumn()
  createdAt: Date;
}
