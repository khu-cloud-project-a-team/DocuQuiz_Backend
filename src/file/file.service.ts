import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from './file.entity';
import { S3Service } from '../aws/s3.service';
import { User } from '../user/user.entity';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
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

    async findAll(user: User): Promise<FileEntity[]> {
        return this.fileRepository.find({
            where: { user: { id: user.id } },
            order: { createdAt: 'DESC' },
        });
    }
}

