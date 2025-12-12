import { Controller, Post, Body, Get, Param, UseGuards, Req } from '@nestjs/common';
import { QuizService, QuizOptions } from './quiz.service';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TokenAuthGuard } from '../user/auth.guard';
import type { Request } from 'express';

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
  @ApiProperty({ description: '파일 DB ID', example: 'uuid-...' })
  fileId: string;

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

class RegenerateFromNoteDto {
  @ApiProperty({ description: '오답노트 ID', example: 'uuid-...' })
  noteId: string;
}

@ApiTags('Quiz')
@UseGuards(TokenAuthGuard)
@Controller('quiz') // http://localhost:3000/quiz
export class QuizController {
  constructor(private readonly quizService: QuizService) { }

  /**
   * 퀴즈 생성을 요청하는 API 엔드포인트
   */
  @Post('generate') // POST /quiz/generate
  @ApiOperation({ summary: '퀴즈 생성', description: 'PDF 파일을 기반으로 퀴즈를 생성합니다.' })
  @ApiResponse({ status: 201, description: '퀴즈 생성 성공' })
  async generateQuiz(@Body() generateQuizDto: GenerateQuizDto, @Req() req: Request) {
    const { fileId, options } = generateQuizDto;
    const user = (req as any).user;
    return this.quizService.generateQuiz(fileId, options, user);
  }

  /**
   * 퀴즈 제출 및 채점
   */
  @Post('submit') // POST /quiz/submit
  @ApiOperation({ summary: '퀴즈 제출', description: '퀴즈 답안을 제출하고 채점 결과를 반환합니다. 오답이 있으면 오답노트 ID도 반환합니다.' })
  @ApiResponse({ status: 201, description: '제출 성공 (점수 및 오답노트 ID 반환)' })
  async submitQuiz(@Body() submitQuizDto: SubmitQuizDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.submitQuiz(submitQuizDto.quizId, submitQuizDto.answers, user);
  }

  /**
   * 오답노트 기반 '맞춤 재출제'를 요청하는 API 엔드포인트
   */
  @Post('regenerate-from-note') // POST /quiz/regenerate-from-note
  @ApiOperation({ summary: '오답노트 기반 재출제', description: '오답노트의 취약점을 분석하여 새로운 퀴즈를 생성합니다.' })
  @ApiResponse({ status: 201, description: '재출제 성공' })
  async regenerateFromNote(@Body() dto: RegenerateFromNoteDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.regenerateFromWrongAnswerNote(dto.noteId, user);
  }

  @Get('stats') // GET /quiz/stats
  @ApiOperation({ summary: '통계 조회', description: '전체 PDF 수, 퀴즈 수, 평균 점수를 반환합니다.' })
  async getStats(@Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.getStats(user);
  }

  @Get('wrong-answer-notes') // GET /quiz/wrong-answer-notes
  @ApiOperation({ summary: '오답노트 목록 조회', description: '모든 오답노트 목록을 반환합니다.' })
  async getWrongAnswerNotes(@Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.getAllWrongAnswerNotes(user);
  }

  @Get() // GET /quiz
  @ApiOperation({ summary: '문제집 목록 조회', description: '생성된 모든 문제집 목록을 반환합니다.' })
  async getAllQuizzes(@Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.getAllQuizzes(user);
  }

  @Get(':id') // GET /quiz/:id
  @ApiOperation({ summary: '퀴즈 조회', description: 'ID로 퀴즈를 조회합니다.' })
  @ApiResponse({ status: 200, description: '퀴즈 조회 성공' })
  async getQuiz(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.getQuiz(id, user);
  }

  @Get(':id/pdf') // GET /quiz/:id/pdf
  @ApiOperation({ summary: '원문 PDF 조회', description: '퀴즈에 연결된 원문 PDF URL을 반환합니다.' })
  @ApiResponse({ status: 200, description: '원문 PDF 정보 반환 성공' })
  async getQuizPdf(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.quizService.getQuizPdf(id, user);
  }

  // TODO: GET /quiz/result/:resultId 구현 필요 (상세 결과 조회)
  // TODO: GET /wrong-answer-note/:noteId 구현 필요 (오답노트 조회)
}
