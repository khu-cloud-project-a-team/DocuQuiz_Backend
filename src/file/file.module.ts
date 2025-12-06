import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileEntity } from './file.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { CoreModule } from '../core/core.module';
import { AwsModule } from '../aws/aws.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEntity, PdfChunkEntity]),
        AwsModule,
        CoreModule,
    ],
    controllers: [FileController],
    providers: [FileService],
    exports: [FileService],
})
export class FileModule { }
