import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class FileEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    originalName: string;

    @Column()
    mimeType: string;

    @Column('int')
    size: number;

    @Column()
    s3Key: string;

    @Column()
    s3Url: string;

    @CreateDateColumn()
    createdAt: Date;
}
