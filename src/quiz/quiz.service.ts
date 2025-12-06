import { Injectable } from '@nestjs/common';
import { PdfService } from '../core/pdf.service';
import { GeminiService, StructuredPdfChunk } from '../core/gemini.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz as QuizEntity, Question as QuestionEntity, QuizResult, UserAnswer } from './quiz.entity';
import { PdfChunkEntity } from '../core/pdf-chunk.entity';
import { WrongAnswerNote, WrongAnswerItem } from './wrong-answer-note.entity';
import { FileEntity } from '../file/file.entity';

// --- 데이터 형식 정의 ---

export interface QuizOptions {
  questionCount: number;
  types: Array<'객관식' | '주관식' | 'OX' | '빈칸'>;
  difficulty: '쉬움' | '보통' | '어려움';
}

export interface RawQuestion {
  id?: string;
  page: number;
  type: '객관식' | '주관식' | 'OX' | '빈칸';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  source_context: string;
}

export interface Quiz {
  id?: string;
  title: string;
  questions: RawQuestion[];
  isRegeneratedQuiz?: boolean;
  weaknessAnalysis?: string;
  pdfInfo?: {
    url: string;
    fileName: string;
  };
}

export interface Misconception {
  originalQuestion: RawQuestion;
  userAnswer: string;
  sourceContext: string;
}

@Injectable()
export class QuizService {
  constructor(
    private readonly pdfService: PdfService,
    private readonly geminiService: GeminiService,
    @InjectRepository(QuizEntity)
    private readonly quizRepository: Repository<QuizEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepository: Repository<QuestionEntity>,
    @InjectRepository(QuizResult)
    private readonly quizResultRepository: Repository<QuizResult>,
    @InjectRepository(UserAnswer)
    private readonly userAnswerRepository: Repository<UserAnswer>,
    @InjectRepository(WrongAnswerNote)
    private readonly wrongAnswerNoteRepository: Repository<WrongAnswerNote>,
    @InjectRepository(WrongAnswerItem)
    private readonly wrongAnswerItemRepository: Repository<WrongAnswerItem>,
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
    @InjectRepository(PdfChunkEntity)
    private readonly pdfChunkRepository: Repository<PdfChunkEntity>,
  ) { }

  async generateQuiz(filePath: string, options: QuizOptions): Promise<Quiz> {
    // 1:1 제약조건: 이미 해당 파일에 대한 퀴즈가 존재하면 기존 퀴즈 반환
    const sourceFile = await this.fileRepository.findOne({ where: { s3Url: filePath } });
    if (sourceFile) {
      const existingQuiz = await this.quizRepository.findOne({
        where: { sourceFile: { id: sourceFile.id }, isRegeneratedQuiz: false },
        relations: ['questions', 'sourceFile']
      });

      if (existingQuiz) {
        console.log(`[Constraint] 기존 퀴즈 반환 (ID: ${existingQuiz.id})`);
        return {
          id: existingQuiz.id,
          title: existingQuiz.title,
          questions: existingQuiz.questions.map(q => ({
            id: q.id,
            page: 0,
            type: q.type as any,
            question: q.text,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            source_context: q.sourceContext,
          })),
        };
      }
    }

    console.log('[Phase 1] DB에서 구조화된 청크 조회 중...');
    // 파일 ID로 청크 조회 (sourceFile이 반드시 존재한다고 가정 - 위에서 조회했으므로)
    if (!sourceFile) {
      throw new Error('파일 정보를 찾을 수 없습니다.');
    }

    const storedChunks = await this.pdfChunkRepository.find({
      where: { file: { id: sourceFile.id } },
      order: { pageNumber: 'ASC' }
    });

    if (storedChunks.length === 0) {
      throw new Error('분석된 PDF 데이터가 없습니다. 파일을 다시 업로드해주세요.');
    }

    const structuredChunks: StructuredPdfChunk[] = storedChunks.map(chunk => ({
      page: chunk.pageNumber,
      content: chunk.content,
      type: chunk.type as any // DB에 저장된 타입 사용
    }));
    console.log(`[Phase 1] 완료. ${structuredChunks.length}개의 청크 로드됨.`);

    console.log('[Phase 1.5] 퀴즈 제목 생성 중...');
    const generatedTitle = await this.geminiService.generateTitle(structuredChunks);
    console.log(`[Phase 1.5] 생성된 제목: ${generatedTitle}`);

    console.log('[Phase 2] 퀴즈 생성 시작...');
    const rawQuestionBank = await this._generateQuestionsFromChunks(structuredChunks, options);
    console.log(`[Phase 2] 완료. 원시 문항 ${rawQuestionBank.length}개 생성.`);

    console.log('[Phase 3] 퀴즈 검증 시작...');
    const verifiedQuestionBank = await this._validateQuestions(rawQuestionBank);
    console.log(`[Phase 3] 완료. 검증된 문항 ${verifiedQuestionBank.length}개 확보.`);

    console.log('[Phase 4] 퀴즈 패키징 시작...');
    const finalQuiz = this._packageQuiz(verifiedQuestionBank, options, generatedTitle);
    console.log('[Phase 4] 완료. 최종 퀴즈 생성.');

    console.log('[Phase 5] DB 저장 시작...');

    const quizToSave = this.quizRepository.create({
      title: finalQuiz.title,
      sourceFile: sourceFile || undefined, // 파일 연결
      questions: finalQuiz.questions.map(q => ({
        text: q.question,
        type: q.type,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation,
        sourceContext: q.source_context,
      })),
    });
    const savedQuiz = await this.quizRepository.save(quizToSave);
    console.log(`[Phase 5] 완료. Quiz ID: ${savedQuiz.id}`);

    return {
      id: savedQuiz.id,
      title: savedQuiz.title,
      questions: savedQuiz.questions.map(q => ({
        id: q.id,
        page: 0,
        type: q.type as any,
        question: q.text,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        source_context: q.sourceContext,
      })),
    };
  }

  async getQuiz(id: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['questions', 'sourceFile'],
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    return {
      id: quiz.id,
      title: quiz.title,
      isRegeneratedQuiz: quiz.isRegeneratedQuiz,
      weaknessAnalysis: quiz.weaknessAnalysis,
      pdfInfo: quiz.sourceFile ? {
        url: quiz.sourceFile.s3Url,
        fileName: quiz.sourceFile.originalName
      } : undefined,
      questions: quiz.questions.map(q => ({
        id: q.id,
        page: 0,
        type: q.type as any,
        question: q.text,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        source_context: q.sourceContext,
      })),
    };
  }

  async submitQuiz(
    quizId: string,
    answers: { questionId: string; selectedAnswer: string }[],
  ) {
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    let correctCount = 0;
    const userAnswers: UserAnswer[] = [];
    const wrongAnswers: WrongAnswerItem[] = [];

    for (const answer of answers) {
      const question = quiz.questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      const isCorrect = question.answer.trim() === answer.selectedAnswer.trim();
      if (isCorrect) correctCount++;

      const userAnswer = this.userAnswerRepository.create({
        questionId: question.id,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      });
      userAnswers.push(userAnswer);

      if (!isCorrect) {
        // 오답 항목 임시 생성 (저장은 나중에)
        const wrongItem = this.wrongAnswerItemRepository.create({
          questionId: question.id,
          questionText: question.text,
          userAnswer: answer.selectedAnswer,
          correctAnswer: question.answer,
          explanation: question.explanation,
          sourceContext: question.sourceContext,
          page: 0 // 페이지 정보가 있다면 추가
        });
        wrongAnswers.push(wrongItem);
      }
    }

    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const quizResult = this.quizResultRepository.create({
      quiz,
      score: Math.round(score),
      totalQuestions,
      correctQuestions: correctCount,
      answers: userAnswers,
    });

    await this.quizResultRepository.save(quizResult);

    // 오답이 있으면 오답노트 자동 생성 (단, 재생성된 퀴즈가 아닐 경우에만)
    let wrongAnswerNoteId: string | null = null;
    if (wrongAnswers.length > 0 && !quiz.isRegeneratedQuiz) {
      const note = await this.createWrongAnswerNote(quizResult, wrongAnswers);
      wrongAnswerNoteId = note.id;
    }

    return {
      id: quizResult.id,
      score: quizResult.score,
      correctQuestions: quizResult.correctQuestions,
      totalQuestions: quizResult.totalQuestions,
      wrongAnswerNoteId,
    };
  }

  // --- 오답노트 및 재생성 관련 메서드 ---

  async createWrongAnswerNote(quizResult: QuizResult, items: WrongAnswerItem[]): Promise<WrongAnswerNote> {
    const note = this.wrongAnswerNoteRepository.create({
      quizResult,
      title: `${quizResult.quiz.title} - 오답노트`,
      items
    });
    return await this.wrongAnswerNoteRepository.save(note);
  }

  async regenerateFromWrongAnswerNote(noteId: string): Promise<Quiz> {
    const note = await this.wrongAnswerNoteRepository.findOne({
      where: { id: noteId },
      relations: ['items', 'quizResult', 'quizResult.quiz', 'quizResult.quiz.sourceFile']
    });

    if (!note) throw new Error('Wrong answer note not found');

    // 1:1 제약조건: 이미 해당 오답노트에 대한 재생성 퀴즈가 존재하면 기존 퀴즈 반환
    const existingRegenQuiz = await this.quizRepository.findOne({
      where: { sourceNoteId: note.id, isRegeneratedQuiz: true },
      relations: ['questions', 'sourceFile']
    });

    if (existingRegenQuiz) {
      console.log(`[Constraint] 기존 재생성 퀴즈 반환 (ID: ${existingRegenQuiz.id})`);
      return {
        id: existingRegenQuiz.id,
        title: existingRegenQuiz.title,
        isRegeneratedQuiz: true,
        weaknessAnalysis: existingRegenQuiz.weaknessAnalysis,
        questions: existingRegenQuiz.questions.map(q => ({
          id: q.id,
          page: 0,
          type: q.type as any,
          question: q.text,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          source_context: q.sourceContext,
        })),
      };
    }

    // 1. 취약점 분석
    const weaknessAnalysis = await this._analyzeWeakness(note.items);

    // 2. 새로운 문제 생성 (3문제, 랜덤 유형, 보통 난이도)
    const newQuestions = await this._generateQuestionsFromWrongAnswers(note.items, weaknessAnalysis);

    // 3. 퀴즈 저장
    const quizToSave = this.quizRepository.create({
      title: `[복습] ${note.title}`,
      isRegeneratedQuiz: true,
      sourceNoteId: note.id,
      weaknessAnalysis: weaknessAnalysis,
      sourceFile: note.quizResult.quiz.sourceFile,
      questions: newQuestions.map(q => ({
        text: q.question,
        type: q.type,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation,
        sourceContext: q.source_context,
      })),
    });

    const savedQuiz = await this.quizRepository.save(quizToSave);

    return {
      id: savedQuiz.id,
      title: savedQuiz.title,
      isRegeneratedQuiz: true,
      weaknessAnalysis,
      questions: savedQuiz.questions.map(q => ({
        id: q.id,
        page: 0,
        type: q.type as any,
        question: q.text,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        source_context: q.sourceContext,
      })),
    };
  }

  async getQuizResult(id: string) {
    const result = await this.quizResultRepository.findOne({
      where: { id },
      relations: ['quiz', 'quiz.sourceFile', 'answers', 'wrongAnswerNote']
    });

    if (!result) throw new Error('Quiz result not found');

    return {
      id: result.id,
      score: result.score,
      totalQuestions: result.totalQuestions,
      correctQuestions: result.correctQuestions,
      quizTitle: result.quiz.title,
      pdfInfo: result.quiz.sourceFile ? {
        url: result.quiz.sourceFile.s3Url,
        fileName: result.quiz.sourceFile.originalName
      } : null,
      wrongAnswerNoteId: result.wrongAnswerNote ? result.wrongAnswerNote.id : null,
      answers: result.answers
    };
  }

  async getWrongAnswerNote(id: string) {
    const note = await this.wrongAnswerNoteRepository.findOne({
      where: { id },
      relations: ['items', 'quizResult', 'quizResult.quiz']
    });

    if (!note) throw new Error('Wrong answer note not found');

    return {
      id: note.id,
      title: note.title,
      quizTitle: note.quizResult.quiz.title,
      items: note.items.map(item => ({
        id: item.id,
        question: item.questionText,
        userAnswer: item.userAnswer,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation,
        sourceContext: item.sourceContext,
        page: item.page
      }))
    };
  }

  async getStats() {
    const pdfCount = await this.fileRepository.count();
    const quizCount = await this.quizRepository.count();
    const results = await this.quizResultRepository.find();
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 0;

    return { pdfCount, quizCount, avgScore };
  }

  async getAllQuizzes() {
    const quizzes = await this.quizRepository.find({
      relations: ['sourceFile', 'questions'], // Fixed: Added 'questions' relation
      order: { createdAt: 'DESC' }
    });

    return quizzes.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      createdAt: quiz.createdAt,
      questionCount: quiz.questions ? quiz.questions.length : 0, // Safe access
      isRegenerated: quiz.isRegeneratedQuiz,
      fileName: quiz.sourceFile ? quiz.sourceFile.originalName : 'Unknown'
    }));
  }

  async getAllWrongAnswerNotes() {
    return this.wrongAnswerNoteRepository.find({
      relations: ['quizResult', 'quizResult.quiz'],
      order: { createdAt: 'DESC' }
    });
  }

  // --- Private Helper Methods ---

  private async _analyzeWeakness(items: WrongAnswerItem[]): Promise<string> {
    const prompt = `
        [오답 목록]
        ${items.map((item, idx) => `
        ${idx + 1}. 문제: ${item.questionText}
           오답: ${item.userAnswer}
           정답: ${item.correctAnswer}
           근거: ${item.sourceContext}
        `).join('\n')}

        [작업 지시]
        위 오답 목록을 분석하여 학생의 '취약점'을 진단해 주세요.
        어떤 개념을 오해하고 있는지, 어떤 유형의 실수를 반복하는지 3~4문장으로 요약해 주세요.
        학생에게 직접 말하는 듯한 부드러운 어조(해요체)를 사용하세요.
      `;

    const result = await this.geminiService.generateContent(prompt);
    return result;
  }

  private async _generateQuestionsFromWrongAnswers(items: WrongAnswerItem[], weaknessAnalysis: string): Promise<RawQuestion[]> {
    const prompt = `
        [취약점 분석]
        ${weaknessAnalysis}

        [오답 문항 및 근거]
        ${items.map((item, idx) => `
        ${idx + 1}. 근거 텍스트: ${item.sourceContext}
        `).join('\n')}

        [작업 지시]
        위 취약점 분석과 오답 문항들의 근거 텍스트를 바탕으로, 학생이 취약한 개념을 보완할 수 있는 **새로운 퀴즈 3문제**를 생성해 주세요.

        [제약 사항]
        1. **난이도**: '보통' (개념 이해 확인용)
        2. **문제 유형**: 객관식, 주관식, 빈칸, OX 중 랜덤하게 섞어서 출제
        3. **내용**: 기존 문제와 똑같이 내지 말고, 같은 개념을 다른 각도에서 묻거나 응용하는 문제를 만드세요.
        4. **해설**: 정답인 이유와 오답인 이유를 명확하게 설명하고, 본문의 어느 부분을 근거로 했는지 구체적으로 명시하세요.
        5. **출력 형식**: 아래 JSON 배열 포맷을 반드시 지키세요.

        [
          { "page": 0, "type": "객관식", "question": "...", "options": ["..."], "answer": "...", "explanation": "...", "source_context": "..." }
        ]
      `;

    try {
      const responseText = await this.geminiService.generateContent(prompt);
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('재생성 퀴즈 생성 실패:', error);
      return [];
    }
  }

  private async _generateQuestionsFromChunks(
    chunks: StructuredPdfChunk[],
    options: QuizOptions,
  ): Promise<RawQuestion[]> {
    const context = chunks
      .map(c => `[Page ${c.page} - ${c.type}]\n${c.content}`)
      .join('\n\n');

    const prompt = `
      [문서 맥락]
      ${context}
      ---
      [작업 지시]
      위 [문서 맥락]을 근거로 하여, 다음 [요청 사항]에 맞는 퀴즈 문항들을 생성해 주십시오.

      [요청 사항]
      - 문제 유형: ${options.types.join(', ')}
      - 난이도: ${options.difficulty}
      - 총 생성 문항 수: ${options.questionCount * 2}개
      - **필수 포함 사항**: 각 문제마다 정답에 대한 명확한 **해설(Explanation)**을 포함해야 합니다. 해설은 정답의 근거가 되는 본문 내용을 인용하거나 논리적으로 설명해야 합니다.

      [난이도 설정 기준]
      1. **쉬움 (Easy)**:
         - **단순 기억/회상**: "무엇인가?", "정의하시오", "나열하시오" 등 단순 사실을 묻습니다.
         - 본문에 있는 문장을 거의 그대로 인용하여 문제를 만듭니다.
         - **객관식**: 오답 보기가 정답과 확연히 다르게 구성됩니다.
         - **OX**: 본문의 문장과 완전히 동일하거나, 명백히 반대되는 내용을 묻습니다.

      2. **보통 (Medium)**:
         - **이해/적용**: "왜 그런가?", "이것의 의미는?", "사례를 고르시오" 등 개념 이해를 묻습니다.
         - 본문의 내용을 약간 변형하거나 요약하여 문제를 만듭니다.
         - **객관식**: 오답 보기가 정답과 비슷해 보일 수 있어 내용을 정확히 알아야 합니다.
         - **빈칸**: 핵심 키워드나 개념어에 빈칸을 뚫습니다.

      3. **어려움 (Hard)**:
         - **분석/추론/종합**: "이 내용이 시사하는 바는?", "다음 상황에 적용했을 때 결과는?", "A와 B의 차이점은?" 등 심화 사고를 요합니다.
         - 여러 단락의 내용을 종합해야 풀 수 있는 문제를 만듭니다.
         - **주관식**: 단답형이 아닌 서술형이나, 이유를 묻는 질문을 포함합니다.
         - **객관식**: 모든 보기가 그럴듯하며, 미세한 차이를 구분해야 합니다.

      [유형별 생성 규칙 ]
      1. **주관식(Short Answer)**: 정답은 반드시 **공백 없는 '단어 하나(Single Word)'**여야 합니다. (예: '합성곱', '뉴런', 'CNN'). 서술형 문장은 절대 금지입니다.
      2. **빈칸(Fill-in-the-blank)**: 원문에 나오는 문장 중 핵심 키워드 부분을 '____'(언더바 4개)로 비워두세요. 정답에는 그 빈칸에 들어갈 단어를 적으세요. 정답은 하나여야 합니다.
      3. **객관식(Multiple Choice)**: 4개의 선지(options) 중 정답은 하나이며, 오답은 헷갈릴 수 있는 그럴듯한 내용이어야 합니다.
      4. **OX**: 원문의 내용을 살짝 비틀거나 그대로 사용하여 참/거짓 문제를 만드세요.

      [해설(explanation) 작성 규칙 ]
      1. **선생님이 학생에게 개념을 이해시키듯이** 자연스러운 구어체로 설명하세요.
      2. **Why(왜)** 정답인지, 그 개념의 **정의와 원리**를 풀어서 설명해야 합니다.
      3. 근거가 되는 원문 페이지를 간단하게 표시하세요. 예를 들어 (page 18) 와 같이 표시하세요.
      4. (예시 - 나쁜 예): "문서에 따르면 CNN은 이미지 처리에 쓰인다고 명시되어 있습니다."
      5. (예시 - 좋은 예): "CNN(합성곱 신경망)은 이미지의 공간적 정보를 유지하며 특징을 추출하는 데 특화된 모델입니다(page 4). 따라서 이미지 분류나 객체 탐지 분야에서 핵심적으로 사용됩니다."

      [출력 규칙]
      - 모든 문항은 [문서 맥락]의 내용에만 100% 근거해야 합니다.
      - 다음 JSON 배열 형식으로만 응답해야 합니다. 마크다운은 반드시 제거하세요
      - 정답(answer)과 상세한 해설(explanation)을 포함해야 합니다.
      [
        { "page": 1, "type": "객관식", "question": "...", "options": ["...", "..."], "answer": "...", "explanation": "...", "source_context": "..." },
        { "page": 2, "type": "주관식", "question": "이미지의 특징을 추출하는 레이어는?", "answer": "합성곱", "explanation": "...", "source_context": "..." },
        { "page": 3, "type": "빈칸", "question": "CNN은 ____ 신경망의 약자이다.", "answer": "합성곱", "explanation": "...", "source_context": "..." }
      ]
    `;

    try {
      const responseText = await this.geminiService.generateContent(prompt);
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (e) {
      console.error('JSON 파싱 실패:', e);
      return [];
    }
  }

  private async _validateQuestions(questions: RawQuestion[]): Promise<RawQuestion[]> {
    // 간단한 검증 로직 (필수 필드 확인)
    return questions.filter(q => q.question && q.answer);
  }

  private _packageQuiz(questions: RawQuestion[], options: QuizOptions, title: string): Quiz {
    // 요청한 개수만큼 자르기
    const selectedQuestions = questions.slice(0, options.questionCount);

    return {
      title: title,
      questions: selectedQuestions,
    };
  }
}