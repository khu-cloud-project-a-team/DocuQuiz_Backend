import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FileService } from './file.service';

class ProcessingCompleteDto {
    s3Key: string;
    chunks: Array<{
        page: number;
        type: string;
        content: string;
    }>;
}

@ApiTags('File Admin')
@Controller('admin/file')
export class FileAdminController {
    constructor(private readonly fileService: FileService) { }

    @Post('processing-complete')
    @ApiOperation({ summary: 'Lambda에서 PDF 처리 완료 알림' })
    async markProcessingComplete(
        @Body() dto: ProcessingCompleteDto,
        @Headers('x-admin-secret') adminSecret: string,
    ) {
        if (adminSecret !== process.env.ADMIN_SECRET) {
            throw new UnauthorizedException('Invalid admin secret');
        }

        return this.fileService.saveProcessedChunks(dto.s3Key, dto.chunks);
    }
}