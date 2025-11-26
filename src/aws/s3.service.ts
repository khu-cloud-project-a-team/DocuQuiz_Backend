import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const region = this.configService.get<string>('AWS_REGION');
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
}
