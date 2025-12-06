import {
    Controller,
    Post,
    Body,
    Get,
    Query,
} from '@nestjs/common';
import { FileService } from './file.service';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

class ConfirmUploadDto {
    fileName: string;
    s3Key: string;
    mimeType: string;
    size: number;
}

@ApiTags('File')
@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) { }

    @Get('presigned-url')
    @ApiOperation({ summary: 'Presigned URL 발급', description: 'S3에 직접 업로드할 수 있는 Presigned URL을 발급합니다.' })
    @ApiQuery({ name: 'fileName', description: '업로드할 파일명', example: 'test.pdf' })
    @ApiResponse({ status: 200, description: 'Presigned URL 발급 성공' })
    async getPresignedUrl(@Query('fileName') fileName: string) {
        return this.fileService.getPresignedUrl(fileName);
    }

    @Post('confirm-upload')
    @ApiOperation({ summary: '업로드 완료 확인', description: 'S3 업로드 완료 후 DB에 파일 메타데이터를 저장합니다.' })
    @ApiBody({ type: ConfirmUploadDto })
    @ApiResponse({ status: 201, description: '파일 메타데이터 저장 성공' })
    async confirmUpload(@Body() dto: ConfirmUploadDto) {
        return this.fileService.confirmUpload(dto.fileName, dto.s3Key, dto.mimeType, dto.size);
    }

    @Get()
    @ApiOperation({ summary: '파일 목록 조회', description: '업로드된 모든 파일 목록을 반환합니다.' })
    @ApiResponse({ status: 200, description: '파일 목록 조회 성공' })
    async getFiles() {
        return this.fileService.findAll();
    }
}

