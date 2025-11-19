// src/quiz/quiz.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { QuizService, QuizOptions, Misconception } from './quiz.service';

// (임시) DTO 정의 - 나중에 dto/ 폴더로 이동
class GenerateQuizDto {
  filePath: string; // 실제로는 S3 URL이나 파일 ID가 됩니다.
  options: QuizOptions;
}

@Controller('quiz') // http://localhost:3000/quiz
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  /**
   * 퀴즈 생성을 요청하는 API 엔드포인트
   */
  @Post('generate') // POST /quiz/generate
  async generateQuiz(@Body() generateQuizDto: GenerateQuizDto) {
    const { filePath, options } = generateQuizDto;

    // (실제 로직)
    // 1. filePath (예: S3 Key)를 기반으로 임시 파일 경로를 얻어옵니다.
    // 2. 여기서는 filePath가 로컬 경로라고 가정합니다.
    const localFilePath = filePath; // (임시)

    return this.quizService.generateQuiz(localFilePath, options);
  }

  /**
   * 오답 기반 '맞춤 재출제'를 요청하는 API 엔드포인트
   */
  @Post('regenerate') // POST /quiz/regenerate
  async regenerateQuiz(@Body() misconceptions: Misconception[]) {
    // 사용자가 틀린 문제 목록을 body로 받습니다.
    return this.quizService.regenerateMisconceptionQuiz(misconceptions);
  }
}