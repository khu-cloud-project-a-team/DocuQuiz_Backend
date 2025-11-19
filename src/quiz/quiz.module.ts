// src/quiz/quiz.module.ts
import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { CoreModule } from '../core/core.module'; // 👈 1. CoreModule 가져오기

@Module({
  imports: [CoreModule], // 👈 2. CoreModule을 imports 배열에 추가
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}