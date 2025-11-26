import { Injectable } from '@nestjs/common';
import { PdfService } from '../core/pdf.service';
import {
  GeminiService,
  StructuredPdfChunk,
} from '../core/gemini.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz as QuizEntity, Question as QuestionEntity, QuizResult, UserAnswer } from './quiz.entity';

// --- 데이터 형식 정의 (나중에 dto/ 폴더로 이동 가능) ---

/** 1. 퀴즈 생성시 사용자가 요청할 옵션 */
export interface QuizOptions {
  questionCount: number;
  types: Array<'객관식' | '주관식' | 'OX' | '빈칸'>;
  difficulty: '쉬움' | '보통' | '어려움';
}

/** 2. LLM이 생성할 '원시 문항'의 형식 */
export interface RawQuestion {
  id?: string; // DB 저장 후 생성된 ID (선택적)
  page: number;
  type: '객관식' | '주관식' | 'OX' | '빈칸';
  question: string;
  options?: string[]; // 객관식용
  answer: string;
  explanation: string;
  source_context: string; // 근거가 된 원문
}

/** 3. 최종 완성된 퀴즈 형식 */
export interface Quiz {
  id?: string; // DB 저장 후 생성된 ID
  title: string;
  questions: RawQuestion[];
}

/** 4. 오답 재출제를 위한 인터페이스 */
export interface Misconception {
  originalQuestion: RawQuestion; // 사용자가 틀린 원본 문항
  userAnswer: string; // 사용자가 제출한 오답
  sourceContext: string; // 원본 문항의 근거가 된 PDF 텍스트
}

// --- 핵심 퀴즈 서비스 ---

@Injectable()
export class QuizService {
  // 1. 서비스 주입 (PdfService와 GeminiService를 사용)
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
  ) { }

  /**
   * (Public) 퀴즈 생성을 요청하는 메인 메서드
   * @param filePath PDF 파일 경로
   * @param options 사용자가 요청한 퀴즈 옵션
   */
  async generateQuiz(
    filePath: string,
    options: QuizOptions,
  ): Promise<Quiz> {
    // === 1단계: PDF 분석 및 전처리 (PdfService + GeminiService) ===
    console.log('[Phase 1] PDF 분석 및 구조화 시작...');
    const rawChunks = await this.pdfService.extractRawText(filePath);
    const structuredChunks = await this.geminiService.structureText(rawChunks);
    console.log('[Phase 1] 완료. 구조화된 청크 생성됨.');

    // === 1.5단계: 퀴즈 제목 생성 ===
    console.log('[Phase 1.5] 퀴즈 제목 생성 중...');
    const generatedTitle = await this.geminiService.generateTitle(structuredChunks);
    console.log(`[Phase 1.5] 생성된 제목: ${generatedTitle}`);

    // === 2단계: 퀴즈 생성 (LLM 1차 호출) ===
    console.log('[Phase 2] 퀴즈 생성 시작...');
    const rawQuestionBank = await this._generateQuestionsFromChunks(
      structuredChunks,
      options,
    );
    console.log(`[Phase 2] 완료. 원시 문항 ${rawQuestionBank.length}개 생성.`);

    // === 3단계: 퀴즈 검증 (LLM 2차 호출 - QC) ===
    console.log('[Phase 3] 퀴즈 검증 시작...');
    const verifiedQuestionBank = await this._validateQuestions(rawQuestionBank);
    console.log(
      `[Phase 3] 완료. 검증된 문항 ${verifiedQuestionBank.length}개 확보.`,
    );

    // === 4단계: 퀴즈 패키징 ===
    console.log('[Phase 4] 퀴즈 패키징 시작...');
    const finalQuiz = this._packageQuiz(verifiedQuestionBank, options, generatedTitle);
    console.log('[Phase 4] 완료. 최종 퀴즈 생성.');

    // === 5단계: DB 저장 ===
    console.log('[Phase 5] DB 저장 시작...');
    const quizToSave = this.quizRepository.create({
      title: finalQuiz.title,
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

    // 중요: 저장된 퀴즈의 ID와 문항들의 ID를 포함하여 반환해야 함
    return {
      id: savedQuiz.id,
      title: savedQuiz.title,
      questions: savedQuiz.questions.map(q => ({
        id: q.id, // 여기서 ID 반환 필수
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

  /**
   * (Public) 퀴즈 ID로 퀴즈 조회
   */
  async getQuiz(id: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['questions'],
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    return {
      id: quiz.id,
      title: quiz.title,
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

  /**
   * (Public) 사용자가 틀린 문항들을 기반으로, '개념 변형' 퀴즈를 생성합니다.
   * (명세서의 '오답노트 & 맞춤 재출제')
   * @param misconceptions - 사용자가 틀린 문항, 답, 근거가 담긴 배열
   */
  async regenerateMisconceptionQuiz(
    misconceptions: Misconception[],
  ): Promise<Quiz> {
    console.log('[Phase R] 오답 기반 재출제 시작...');
    const regeneratedQuestions: RawQuestion[] = [];

    // (성능 향상을 위해 Promise.all로 병렬 처리)
    const regenerationJobs = misconceptions.map(item =>
      this._generateSingleRegenQuestion(item),
    );

    // 생성된 새 문항들을 수집
    const results = await Promise.all(regenerationJobs);
    results.forEach(q => {
      if (q) regeneratedQuestions.push(q); // null이 아닌 유효한 문항만 추가
    });

    console.log(`[Phase R] 완료. 새 변형 문항 ${regeneratedQuestions.length}개 생성.`);

    // 새 문항들을 '복습 퀴즈'로 패키징
    return {
      title: '나만의 취약점 복습 퀴즈',
      questions: regeneratedQuestions,
    };
  }

  /**
   * (Public) 퀴즈 제출 및 채점
   * @param quizId 퀴즈 ID
   * @param answers 사용자가 제출한 답안 목록
   */
  async submitQuiz(
    quizId: string,
    answers: { questionId: string; selectedAnswer: string }[],
  ) {
    // 1. 퀴즈 및 문항 조회
    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
      relations: ['questions'],
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    let correctCount = 0;
    const userAnswers: UserAnswer[] = [];

    // 2. 채점 로직
    for (const answer of answers) {
      const question = quiz.questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      // 정답 비교 (간단한 문자열 비교, 대소문자 무시 등 로직 추가 가능)
      const isCorrect = question.answer.trim() === answer.selectedAnswer.trim();
      if (isCorrect) correctCount++;

      const userAnswer = this.userAnswerRepository.create({
        questionId: question.id,
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      });
      userAnswers.push(userAnswer);
    }

    // 3. 결과 저장
    const totalQuestions = quiz.questions.length;
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    const quizResult = this.quizResultRepository.create({
      quiz,
      score: Math.round(score), // 정수로 저장
      totalQuestions,
      correctQuestions: correctCount,
      answers: userAnswers,
    });

    await this.quizResultRepository.save(quizResult);

    return {
      id: quizResult.id,
      score: quizResult.score,
      correctQuestions: quizResult.correctQuestions,
      totalQuestions: quizResult.totalQuestions,
    };
  }

  // --- Private Helper Methods ---

  /**
   * (Private) 1단계에서 구조화된 청크를 바탕으로 LLM을 호출하여 '원시 퀴즈'를 생성합니다.
   * (명세서의 'LLM 분석 & 문항 생성')
   */
  private async _generateQuestionsFromChunks(
    chunks: StructuredPdfChunk[],
    options: QuizOptions,
  ): Promise<RawQuestion[]> {
    // 1. Gemini에게 전달할 프롬프트 구성
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

      [난이도 설정 기준]
      1. **쉬움 (Easy)**:
         - **단순 기억/회상**: "무엇인가?", "정의하시오", "나열하시오" 등 단순 사실을 묻습니다.
         - 본문에 있는 문장을 거의 그대로 인용하여 문제를 만듭니다.
         - 꼬아내지 않고 직관적이어야 합니다.
      
      2. **보통 (Medium)**:
         - **이해/설명**: "왜 그런가?", "의미하는 바는?", "요약하시오" 등 개념의 이해를 묻습니다.
         - 단순 암기가 아니라, 문맥을 파악해야 풀 수 있게 만듭니다.
         - 본문의 내용을 살짝 다른 표현(Paraphrasing)으로 바꾸어 출제합니다.

      3. **어려움 (Hard)**:
         - **적용/분석/추론**: "이 원리를 ~에 적용하면?", "A와 B의 차이점은?", "~라면 어떤 결과가 나오는가?" 등 심화 사고를 요합니다.
         - 서로 다른 문단에 흩어진 정보를 종합해야 풀 수 있게 만듭니다.
         - 오답(Distractor)을 매우 정교하게 만들어 헷갈리게 유도합니다.

      [유형별 생성 규칙 ]
      1. **주관식(Short Answer)**: 정답은 반드시 **공백 없는 '단어 하나(Single Word)'**여야 합니다. (예: '합성곱', '뉴런', 'CNN'). 서술형 문장은 절대 금지입니다.
      2. **빈칸(Fill-in-the-blank)**: 원문에 나오는 문장 중 핵심 키워드 부분을 '____'(언더바 4개)로 비워두세요. 정답에는 그 빈칸에 들어갈 단어를 적으세요.
      3. **객관식(Multiple Choice)**: 4개의 선지(options) 중 정답은 하나이며, 오답은 헷갈릴 수 있는 그럴듯한 내용이어야 합니다.
      4. **OX**: 원문의 내용을 살짝 비틀거나 그대로 사용하여 참/거짓 문제를 만드세요.

      [해설(explanation) 작성 규칙 ]
      1. **선생님이 학생에게 개념을 이해시키듯이** 자연스러운 구어체로 설명하세요.
      2. **Why(왜)** 정답인지, 그 개념의 **정의와 원리**를 풀어서 설명해야 합니다.
      3. (예시 - 나쁜 예): "문서에 따르면 CNN은 이미지 처리에 쓰인다고 명시되어 있습니다."
      4. (예시 - 좋은 예): "CNN(합성곱 신경망)은 이미지의 공간적 정보를 유지하며 특징을 추출하는 데 특화된 모델입니다. 따라서 이미지 분류나 객체 탐지 분야에서 핵심적으로 사용됩니다."

      [출력 규칙]
      - 모든 문항은 [문서 맥락]의 내용에만 100% 근거해야 합니다.
      - 다음 JSON 배열 형식으로만 응답해야 합니다. (마크다운 제외)
      - 정답(answer)과 상세한 해설(explanation)을 포함해야 합니다.
      [
        { "page": 1, "type": "객관식", "question": "...", "options": ["...", "..."], "answer": "...", "explanation": "...", "source_context": "..." },
        { "page": 2, "type": "주관식", "question": "이미지의 특징을 추출하는 레이어는?", "answer": "합성곱", "explanation": "...", "source_context": "..." },
        { "page": 3, "type": "빈칸", "question": "CNN은 ____ 신경망의 약자이다.", "answer": "합성곱", "explanation": "...", "source_context": "..." }
      ]
    `;

    // 2. GeminiService를 통해 LLM 호출
    try {
      const responseText = await this.geminiService.generateContent(prompt);
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('퀴즈 생성(_generateQuestionsFromChunks) 중 오류:', error);
      return []; // 오류 발생 시 빈 배열 반환
    }
  }

  /**
   * (Private) 2단계에서 생성된 '원시 문항'이 명세서의 QC 기준을 통과하는지 검증합니다.
   * (명세서의 '품질검사 / 근거 검증')
   */
  private async _validateQuestions(
    rawQuestions: RawQuestion[],
  ): Promise<RawQuestion[]> {
    const verifiedQuestions: RawQuestion[] = [];

    // (실제로는 이 부분을 Promise.all로 병렬 처리해야 합니다)
    for (const question of rawQuestions) {
      const prompt = `
        [검증 대상 문항]
        ${JSON.stringify(question)}
        
        [검증 기준]
        1. 정답 유일성: 문항의 정답(answer)이 명확하고 유일합니까?
        2. 오답 품질 (객관식): 오답 보기가 너무 쉽거나 문항과 무관하지 않습니까?
        3. 근거 검증: 문항/정답/해설이 근거(source_context)와 일치합니까?

        [작업 지시]
        위 [검증 기준]을 바탕으로 [검증 대상 문항]을 평가하여, 통과하면 "true", 실패하면 "false"만 응답하십시오.
      `;

      try {
        const responseText = await this.geminiService.generateContent(prompt);
        const isValid = responseText.toLowerCase().includes('true');

        if (isValid) {
          verifiedQuestions.push(question);
        }
      } catch (error) {
        console.error('퀴즈 검증(_validateQuestions) 중 오류:', error);
        // 개별 문항 검증 실패 시 로그만 남기고 계속 진행
      }
    }
    return verifiedQuestions;
  }

  /**
   * (Private) 3단계에서 검증된 문항들을 사용자의 최종 요청에 맞게 선별하고 포장합니다.
   * (명세서의 '퀴즈 패키징')
   */
  private _packageQuiz(
    verifiedQuestions: RawQuestion[],
    options: QuizOptions,
    title: string,
  ): Quiz {
    // 1. 요청한 유형(types)으로 필터링
    let packagedQuestions = verifiedQuestions.filter(q =>
      options.types.includes(q.type),
    );

    // 2. 요청한 개수(questionCount)만큼 자르기 (랜덤 셔플 로직 추가 가능)
    // (예시: 간단한 셔플)
    packagedQuestions.sort(() => Math.random() - 0.5);

    // 3. 최종 개수만큼 선택
    packagedQuestions = packagedQuestions.slice(0, options.questionCount);

    // (추가 로직: 명세서의 '동일 토픽 연속 출제 제한' 등 알고리즘 구현)

    return {
      title: title,
      questions: packagedQuestions,
    };
  }

  /**
   * (Private) 단일 오답 정보를 받아 변형된 '새 문항' 1개를 생성합니다.
   */
  private async _generateSingleRegenQuestion(
    item: Misconception,
  ): Promise<RawQuestion | null> {
    const { originalQuestion, userAnswer, sourceContext } = item;

    // 1. [Re-generator] 프롬프트 설계
    const prompt = `
      [학습 상황]
      학생이 이전에 다음 [원본 문항]을 풀다가 [학생의 오답]을 선택하여 틀렸습니다.
      이 문항의 핵심 개념은 [원본 근거]에서 파악할 수 있습니다.

      [원본 문항]
      ${originalQuestion.question}
      (정답: ${originalQuestion.answer})

      [학생의 오답]
      ${userAnswer}

      [원본 근거]
      ---
      ${sourceContext}
      ---

      [작업 지시]
      위 [학습 상황]을 바탕으로, 학생이 틀린 "핵심 개념"을 다시 학습할 수 있도록 [원본 문항]을 '변형'하여 [새로운 문항] 1개를 생성하십시오.

      [변형 규칙]
      1. 다른 표현, 다른 수치, 다른 사례를 사용해야 합니다.
      2. 절대 [원본 문항]과 동일한 질문을 만들면 안 됩니다.
      3. [새로운 문항] 역시 반드시 [원본 근거] 텍스트만으로 풀 수 있어야 합니다.

      [출력 규칙]
      - [원본 문항]과 동일한 JSON 형식으로 [새로운 문항] 1개만 응답하십시오.
      - (page, type, question, options, answer, explanation, source_context)
    `;

    try {
      // 2. GeminiService를 통해 LLM 호출
      const responseText = await this.geminiService.generateContent(prompt);

      const jsonText = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // 3. 새 문항 파싱
      return JSON.parse(jsonText);

    } catch (error) {
      console.error('오답 재출제 문항 생성 중 오류:', error);
      return null; // 한 문항이 실패해도 전체가 중단되지 않도록 null 반환
    }
  }
}