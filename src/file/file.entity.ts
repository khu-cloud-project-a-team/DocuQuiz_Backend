import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';

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

    @OneToMany(() => PdfChunkEntity, (chunk) => chunk.file)
    pdfChunks: PdfChunkEntity[];
}
