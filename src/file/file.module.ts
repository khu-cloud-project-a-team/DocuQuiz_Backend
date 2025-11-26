import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileEntity } from './file.entity';
import { AwsModule } from '../aws/aws.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([FileEntity]),
        AwsModule,
    ],
    controllers: [FileController],
    providers: [FileService],
    exports: [FileService],
})
export class FileModule { }
