// src/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { CoreModule } from '../core/core.module';
import { Quiz, Question, QuizResult, UserAnswer } from './quiz.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, Question, QuizResult, UserAnswer]),
    CoreModule
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule { }