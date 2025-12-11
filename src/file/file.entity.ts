import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../user/user.entity';

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

    @Column({ default: false })
    status: boolean; // PDF 분석 완료 여부

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => PdfChunkEntity, (chunk) => chunk.file)
    pdfChunks: PdfChunkEntity[];

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User | null;
}
