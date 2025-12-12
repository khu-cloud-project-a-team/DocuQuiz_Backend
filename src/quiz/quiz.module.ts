// src/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { CoreModule } from '../core/core.module';
import { Quiz, Question, QuizResult, UserAnswer } from './quiz.entity';
import { WrongAnswerNote, WrongAnswerItem } from './wrong-answer-note.entity';
import { FileEntity } from '../file/file.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { User } from '../user/user.entity';
import { UserModule } from '../user/user.module';
import { TokenAuthGuard } from '../user/auth.guard';
import { AwsModule } from '../aws/aws.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      Question,
      QuizResult,
      UserAnswer,
      WrongAnswerNote,
      WrongAnswerItem,
      FileEntity,
      PdfChunkEntity,
      User,
    ]),
    CoreModule,
    UserModule,
    AwsModule,
  ],
  controllers: [QuizController],
  providers: [QuizService, TokenAuthGuard],
})
export class QuizModule { }
