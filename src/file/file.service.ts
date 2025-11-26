import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from './file.entity';
import { S3Service } from '../aws/s3.service';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        private readonly s3Service: S3Service,
    ) { }

    async uploadFile(file: Express.Multer.File): Promise<FileEntity> {
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

        return this.fileRepository.save(newFile);
    }
}
