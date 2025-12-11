import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { FileAdminController } from './file-admin.controller';
import { FileService } from './file.service';
import { FileEntity } from './file.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { AwsModule } from '../aws/aws.module';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { TokenAuthGuard } from '../user/auth.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEntity, PdfChunkEntity, User]),
        AwsModule,
        UserModule,
    ],
    controllers: [FileController, FileAdminController],
    providers: [FileService, TokenAuthGuard],
    exports: [FileService],
})
export class FileModule { }

