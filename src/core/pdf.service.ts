// src/core/pdf.service.ts
import { Injectable } from '@nestjs/common';
// TextItem, TextMarkedContent 같은 타입 임포트는 제거합니다.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface RawPdfChunk {
  page: number;
  content: string;
}

@Injectable()
export class PdfService {
  async extractRawText(filePath: string): Promise<RawPdfChunk[]> {
    console.log(`PDF 분석 시작: ${filePath}`);
    const loadingTask = getDocument(filePath);

    try {
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const allTextChunks: RawPdfChunk[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // --- ⬇️ 여기가 수정된 부분입니다 ⬇️ ---

        // 1. 텍스트를 담을 빈 배열을 생성합니다.
        const strings: string[] = [];
        
        // 2. textContent.items를 for...of 루프로 순회합니다.
        for (const item of textContent.items) {
          // 3. 'str' 속성이 객체에 있는지 확인합니다. (타입 가드)
          if ('str' in item) {
            // 4. 'str'이 있으면 item.str을 배열에 추가합니다.
            strings.push(item.str);
          }
          // 'str'이 없는 TextMarkedContent는 무시됩니다.
        }

        // 5. 배열을 합쳐 pageText를 만듭니다.
        const pageText = strings.join(' ');

        // --- ⬆️ 여기까지 수정된 부분입니다 ⬆️ ---

        allTextChunks.push({
          page: i,
          content: pageText,
        });
      }

      console.log(`PDF 분석 완료: 총 ${numPages} 페이지`);
      return allTextChunks;

    } catch (err) {
      console.error('PDF 분석 중 오류 발생:', err);
      throw new Error('PDF 텍스트 추출에 실패했습니다.');
    }
  }
}