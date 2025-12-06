// src/core/core.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfChunkEntity } from './pdf-chunk.entity';
import { PdfService } from './pdf.service';
import { GeminiService } from './gemini.service';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PdfChunkEntity]),
    AwsModule
  ],
  providers: [PdfService, GeminiService],
  // 이 서비스들을 다른 모듈(예: QuizModule)에서도 사용할 수 있도록 exports
  exports: [PdfService, GeminiService],
})
export class CoreModule { }