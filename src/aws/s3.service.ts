import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost as awsCreatePresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const region = this.configService.get<string>('AWS_REGION') || 'ap-northeast-2';
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

        if (!region || !accessKeyId || !secretAccessKey || !this.bucketName) {
            console.error('Missing AWS Config:', {
                region: !!region,
                accessKeyId: !!accessKeyId,
                secretAccessKey: !!secretAccessKey,
                bucketName: !!this.bucketName,
            });
            throw new Error('AWS configuration is missing');
        }

        this.s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }

    getS3Client(): S3Client {
        return this.s3Client;
    }

    getBucketName(): string {
        return this.bucketName;
    }

    /**
     * Presigned POST URL 생성
     * 클라이언트가 S3에 직접 파일을 업로드할 수 있는 URL과 필드를 반환
     */
    async createPresignedPost(fileName: string): Promise<{ url: string; fields: Record<string, string>; key: string }> {
        const fileExtension = fileName.split('.').pop();
        const key = `pdf/${uuidv4()}.${fileExtension}`;

        const { url, fields } = await awsCreatePresignedPost(this.s3Client, {
            Bucket: this.bucketName,
            Key: key,
            Conditions: [
                ['content-length-range', 0, 10485760], // 파일 크기 제한: 0~10MB
            ],
            Fields: {},
            Expires: 3600, // 1시간 유효
        });

        return { url, fields, key };
    }

    /**
     * Presigned GET URL 생성
     * S3 객체를 일정 시간 동안 조회할 수 있는 임시 URL 반환
     */
    async getPresignedGetUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }
}
