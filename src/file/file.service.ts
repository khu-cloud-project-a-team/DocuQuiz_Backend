import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from './file.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { PdfService } from '../core/pdf.service';
import { GeminiService } from '../core/gemini.service';
import { S3Service } from '../aws/s3.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        @InjectRepository(PdfChunkEntity)
        private readonly pdfChunkRepository: Repository<PdfChunkEntity>,
        private readonly s3Service: S3Service,
        private readonly pdfService: PdfService,
        private readonly geminiService: GeminiService,
    ) { }

    async uploadFile(file: Express.Multer.File): Promise<FileEntity> {
        // 파일명 인코딩 보정 (Multer 한글 깨짐 방지)
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

        const bucketName = this.s3Service.getBucketName();
        const fileExtension = file.originalname.split('.').pop();
        const s3Key = `${uuidv4()}.${fileExtension}`;

        // 1. Upload to S3
        await this.s3Service.getS3Client().send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );

        const s3Url = `https://${bucketName}.s3.${await this.s3Service.getS3Client().config.region()}.amazonaws.com/${s3Key}`;

        // 2. Save metadata to DB
        const newFile = this.fileRepository.create({
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            s3Key: s3Key,
            s3Url: s3Url,
        });

        const savedFile = await this.fileRepository.save(newFile);

        // 3. Chunk PDF and save to DB
        if (file.mimetype === 'application/pdf') {
            try {
                // 1. Raw Text 추출
                const rawChunks = await this.pdfService.extractRawText(file.buffer);

                // 2. Gemini를 통한 구조화 (LLM 분석)
                const structuredChunks = await this.geminiService.structureText(rawChunks);

                // 3. DB 저장
                const chunkEntities = structuredChunks.map(chunk => this.pdfChunkRepository.create({
                    content: chunk.content,
                    pageNumber: chunk.page,
                    type: chunk.type, // 구조화된 타입 저장
                    file: savedFile,
                }));
                await this.pdfChunkRepository.save(chunkEntities);
                console.log(`PDF Chunk 저장 완료: ${chunkEntities.length}개 (구조화됨)`);
            } catch (e) {
                console.error('PDF Chunking 및 구조화 실패:', e);
            }
        }

        return savedFile;
    }
    async findAll(): Promise<FileEntity[]> {
        return this.fileRepository.find({ order: { createdAt: 'DESC' } });
    }
}
