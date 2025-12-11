import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from './file.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { S3Service } from '../aws/s3.service';
import { User } from '../user/user.entity';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        @InjectRepository(PdfChunkEntity)
        private readonly pdfChunkRepository: Repository<PdfChunkEntity>,
        private readonly s3Service: S3Service,
    ) { }

    /**
     * Presigned URL 발급
     * 클라이언트가 S3에 직접 업로드할 수 있는 URL과 필드를 반환
     */
    async getPresignedUrl(fileName: string) {
        const { url, fields, key } = await this.s3Service.createPresignedPost(fileName);

        return {
            url,
            fields,
            key,
        };
    }

    /**
     * 업로드 완료 확인 및 DB 저장
     * 클라이언트가 S3 업로드 완료 후 호출하여 파일 메타데이터를 DB에 저장
     */
    async confirmUpload(fileName: string, s3Key: string, mimeType: string, size: number, user: User): Promise<FileEntity> {
        const bucketName = this.s3Service.getBucketName();
        const s3Url = `https://${bucketName}.s3.ap-northeast-2.amazonaws.com/${s3Key}`;

        const newFile = this.fileRepository.create({
            originalName: fileName,
            mimeType: mimeType,
            size: size,
            s3Key: s3Key,
            s3Url: s3Url,
            user: user || null,
        });

        return await this.fileRepository.save(newFile);
    }


    async saveProcessedChunks(
        s3Key: string,
        chunks: Array<{ page: number; type: string; content: string }>
    ): Promise<FileEntity> {
        const file = await this.fileRepository.findOne({
            where: { s3Key },
        });

        if (!file) {
            throw new Error('File not found');
        }

        // 청크 데이터를 PdfChunkEntity로 변환하여 저장
        const pdfChunks = chunks.map(chunk => {
            const pdfChunk = this.pdfChunkRepository.create({
                content: chunk.content,
                type: chunk.type,
                pageNumber: chunk.page,
                file: file,
            });
            return pdfChunk;
        });

        // 벌크 저장
        await this.pdfChunkRepository.save(pdfChunks);

        // 파일 처리 완료 상태 업데이트
        file.status = true;
        return await this.fileRepository.save(file);
    }

    async findAll(user: User): Promise<FileEntity[]> {
        return this.fileRepository.find({
            where: { user: { id: user.id } },
            order: { createdAt: 'DESC' },
        });
    }
}

