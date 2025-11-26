import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { QuizService, QuizOptions, Misconception } from './quiz.service';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';

// (임시) DTO 정의 - 나중에 dto/ 폴더로 이동
class QuizOptionsDto {
  @ApiProperty({ description: '문항 수', example: 10 })
  questionCount: number;

  @ApiProperty({ description: '문제 유형', example: ['객관식', '주관식'], isArray: true, type: String })
  types: Array<'객관식' | '주관식' | 'OX' | '빈칸'>;

  @ApiProperty({ description: '난이도', example: '보통', enum: ['쉬움', '보통', '어려움'] })
  difficulty: '쉬움' | '보통' | '어려움';
}

class GenerateQuizDto {
  @ApiProperty({ description: 'PDF 파일 경로 (또는 S3 URL)', example: 'https://example.com/file.pdf' })
  filePath: string;

  @ApiProperty({ description: '퀴즈 옵션', type: QuizOptionsDto })
  options: QuizOptionsDto;
}

class SubmitAnswerDto {
  @ApiProperty({ description: '문항 ID', example: 'uuid-...' })
  questionId: string;

  @ApiProperty({ description: '사용자가 선택한 답', example: '합성곱' })
  selectedAnswer: string;
}

class SubmitQuizDto {
  @ApiProperty({ description: '퀴즈 ID', example: 'uuid-...' })
  quizId: string;

  @ApiProperty({ description: '제출 답안 목록', type: [SubmitAnswerDto] })
  answers: SubmitAnswerDto[];
}

@ApiTags('Quiz')
@Controller('quiz') // http://localhost:3000/quiz
export class QuizController {
  constructor(private readonly quizService: QuizService) { }

  /**
   * 퀴즈 생성을 요청하는 API 엔드포인트
   */
  @Post('generate') // POST /quiz/generate
  @ApiOperation({ summary: '퀴즈 생성', description: 'PDF 파일을 기반으로 퀴즈를 생성합니다.' })
  @ApiResponse({ status: 201, description: '퀴즈 생성 성공' })
  async generateQuiz(@Body() generateQuizDto: GenerateQuizDto) {
    const { filePath, options } = generateQuizDto;

    // (실제 로직)
    // 1. filePath (예: S3 Key)를 기반으로 임시 파일 경로를 얻어옵니다.
    // 2. 여기서는 filePath가 로컬 경로라고 가정합니다.
    const localFilePath = filePath; // (임시)

    return this.quizService.generateQuiz(localFilePath, options);
  }

  /**
   * 퀴즈 제출 및 채점
   */
  @Post('submit') // POST /quiz/submit
  @ApiOperation({ summary: '퀴즈 제출', description: '퀴즈 답안을 제출하고 채점 결과를 반환합니다.' })
  @ApiResponse({ status: 201, description: '제출 성공 (점수 반환)' })
  async submitQuiz(@Body() submitQuizDto: SubmitQuizDto) {
    return this.quizService.submitQuiz(submitQuizDto.quizId, submitQuizDto.answers);
  }

  /**
   * 오답 기반 '맞춤 재출제'를 요청하는 API 엔드포인트
   */
  @Post('regenerate') // POST /quiz/regenerate
  @ApiOperation({ summary: '오답 기반 재출제', description: '틀린 문제를 기반으로 새로운 문제를 생성합니다.' })
  @ApiResponse({ status: 201, description: '재출제 성공' })
  async regenerateQuiz(@Body() misconceptions: Misconception[]) {
    // 사용자가 틀린 문제 목록을 body로 받습니다.
    return this.quizService.regenerateMisconceptionQuiz(misconceptions);
  }

  @Get(':id') // GET /quiz/:id
  @ApiOperation({ summary: '퀴즈 조회', description: 'ID로 퀴즈를 조회합니다.' })
  @ApiResponse({ status: 200, description: '퀴즈 조회 성공' })
  async getQuiz(@Param('id') id: string) {
    return this.quizService.getQuiz(id);
  }
}