import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { FileEntity } from '../file/file.entity';

@Entity()
export class PdfChunkEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('text')
    content: string;

    @Column({ default: 'unknown' })
    type: string;

    @Column('int')
    pageNumber: number;

    @ManyToOne(() => FileEntity, (file) => file.pdfChunks, { onDelete: 'CASCADE' })
    file: FileEntity;

    @CreateDateColumn()
    createdAt: Date;
}
