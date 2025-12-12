import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RawPdfChunk } from './pdf.service';

// Gemini가 구조화해줄 데이터 형식 정의
export interface StructuredPdfChunk {
  page: number;
  type: 'header' | 'paragraph' | 'list' | 'table' | 'unknown';
  content: string;
}

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    // 퀴즈 생성을 위한 고성능 모델 사용 (JSON 모드 활성화)
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
  }

  /**
   * (Public) Gemini API에 프롬프트를 보내고 텍스트 응답을 받습니다.
   * @param prompt - LLM에 보낼 전체 프롬프트 문자열
   * @returns Gemini가 생성한 텍스트 응답
   */
  async generateContent(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text(); // 순수 텍스트만 반환
    } catch (error) {
      console.error('Gemini API 호출 중 오류:', JSON.stringify(error, null, 2));
      throw new Error(`Gemini 콘텐츠 생성 실패: ${error.message}`);
    }
  }

  /**
   * 구조화된 텍스트를 기반으로 퀴즈 제목을 생성합니다.
   * @param chunks - 구조화된 텍스트 청크
   */
  async generateTitle(chunks: StructuredPdfChunk[]): Promise<string> {
    // 제목 생성을 위해 앞부분(최대 3페이지)만 사용
    const context = chunks
      .filter(c => c.page <= 3)
      .map(c => c.content)
      .join('\n');

    const prompt = `
      다음은 문서의 앞부분 내용입니다:
      ${context}

      위 내용을 바탕으로 이 문서의 내용을 가장 잘 요약하는 '퀴즈 제목'을 1개만 생성해 주세요.
      
      [조건]
      1. 20자 이내의 한국어로 작성하세요.
      2. "퀴즈", "시험" 같은 단어는 포함하지 마세요. (예: "인공지능의 역사", "광합성의 원리")
      3. 따옴표나 부가 설명 없이 제목 텍스트만 출력하세요.
    `;

    try {
      const title = await this.generateContent(prompt);
      return title.trim();
    } catch (error) {
      console.error('제목 생성 중 오류:', error);
      return '생성된 퀴즈'; // 기본값
    }
  }

  /**
   * 원시 텍스트 청크를 받아 Gemini를 통해 구조화된 데이터로 변환합니다.
   * @param chunks - PdfService가 추출한 원시 텍스트 배열
   * @returns Gemini가 구조화한 텍스트 청크 배열
   */
  async structureText(chunks: RawPdfChunk[]): Promise<StructuredPdfChunk[]> {
    console.log('Gemini로 텍스트 구조화 시작...');

    // 1. 시스템 프롬프트 정의
    const systemPrompt = `
      당신은 PDF 문서를 의미론적으로 분석하는 AI입니다.
      페이지 번호(PAGE X)와 원시 텍스트가 덩어리로 주어집니다.
      이 텍스트를 분석하여 "header"(제목), "paragraph"(문단), "list"(목록), "table"(표), "unknown"(기타) 유형으로 분류해야 합니다.
      
      [분석 규칙]
      1. **헤더/푸터 제외**: 페이지 상단/하단의 단순 페이지 번호, 반복되는 문서 제목, 날짜 등은 분석에서 제외하거나 "unknown"으로 처리하지 말고 아예 출력하지 마십시오.
      2. **의미 단위**: 문장이 페이지를 넘어가는 경우, 문맥을 파악하여 적절히 문단으로 합치거나 분리하십시오.
      3. **JSON 포맷**: 원본 페이지 번호를 반드시 유지해야 하며, 지정된 JSON 배열 형식으로만 응답해야 합니다.

      [출력 JSON 형식 예시]
      [
        { "page": 1, "type": "header", "content": "1. 서론" },
        { "page": 1, "type": "paragraph", "content": "컴퓨터 비전은 기계가..." },
        { "page": 2, "type": "list", "content": "- 항목 1\n- 항목 2" }
      ]
    `;

    // 2. 입력 텍스트 포맷팅 (Gemini에게 전달할 형식)
    const inputText = chunks
      .map(chunk => `--- PAGE ${chunk.page} ---\n${chunk.content}\n`)
      .join('\n');

    const prompt = `${systemPrompt}\n\n[입력 원시 텍스트]\n${inputText}\n\n[출력 JSON]:`;

    // 3. Gemini API 호출
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;

      // Gemini가 반환한 텍스트에서 JSON 부분만 추출
      const jsonText = response.text()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // 4. JSON 파싱
      const structuredData: StructuredPdfChunk[] = JSON.parse(jsonText);
      console.log('Gemini 텍스트 구조화 완료.');
      return structuredData;

    } catch (err) {
      console.error('Gemini API 호출 중 오류 발생:', JSON.stringify(err, null, 2));
      throw new Error(`Gemini 텍스트 구조화 실패: ${err.message}`);
    }
  }
}