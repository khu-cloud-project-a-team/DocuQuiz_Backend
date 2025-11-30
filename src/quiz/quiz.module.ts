// src/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { CoreModule } from '../core/core.module';
import { Quiz, Question, QuizResult, UserAnswer } from './quiz.entity';
import { WrongAnswerNote, WrongAnswerItem } from './wrong-answer-note.entity';
import { FileEntity } from '../file/file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, Question, QuizResult, UserAnswer, WrongAnswerNote, WrongAnswerItem, FileEntity]),
    CoreModule
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule { }