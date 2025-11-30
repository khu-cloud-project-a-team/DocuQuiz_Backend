import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('File')
@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) { }

    @Post('upload')
    @ApiOperation({ summary: '파일 업로드', description: 'PDF 파일을 업로드하고 메타데이터를 반환합니다.' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: '파일 업로드 성공' })
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        return this.fileService.uploadFile(file);
    }
    @Get()
    @ApiOperation({ summary: '파일 목록 조회', description: '업로드된 모든 파일 목록을 반환합니다.' })
    @ApiResponse({ status: 200, description: '파일 목록 조회 성공' })
    async getFiles() {
        return this.fileService.findAll();
    }
}
