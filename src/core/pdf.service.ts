import { Injectable } from '@nestjs/common';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import axios from 'axios';
import { S3Service } from '../aws/s3.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export interface RawPdfChunk {
  page: number;
  content: string;
}

@Injectable()
export class PdfService {
  constructor(private readonly s3Service: S3Service) { }

  async extractRawText(filePath: string): Promise<RawPdfChunk[]> {
    console.log(`PDF 분석 시작: ${filePath}`);

    let data: string | Uint8Array = filePath;

    // URL인 경우 처리
    if (filePath.startsWith('http')) {
      // S3 URL인지 확인 (간단한 체크)
      const bucketName = this.s3Service.getBucketName();
      const isS3Url = filePath.includes('s3') && filePath.includes('amazonaws.com');

      if (isS3Url) {
        try {
          console.log('S3 URL 감지됨. AWS SDK로 다운로드 시도...');

          const url = new URL(filePath);
          // pathname은 /key 형태이므로 앞의 / 제거
          const key = url.pathname.substring(1);

          console.log(`S3 Key 추출: ${key}`);

          const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
          });

          const s3Response = await this.s3Service.getS3Client().send(command);

          // Stream to Buffer
          const stream = s3Response.Body as Readable;
          const chunks: Uint8Array[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);

          // Buffer를 순수 Uint8Array로 변환 (pdfjs-dist 요구사항)
          data = new Uint8Array(buffer);

          console.log('S3 파일 다운로드 완료.');

        } catch (s3Error) {
          console.error('S3 다운로드 실패, 일반 HTTP 요청으로 전환:', s3Error);
          // S3 실패 시 일반 HTTP로 재시도 (Public일 경우)
          try {
            const response = await axios.get(filePath, { responseType: 'arraybuffer' });
            data = new Uint8Array(response.data);
          } catch (httpError) {
            throw new Error('PDF 파일을 다운로드할 수 없습니다.');
          }
        }
      } else {
        // 일반 URL
        try {
          console.log('일반 URL 감지됨. 파일 다운로드 중...');
          const response = await axios.get(filePath, { responseType: 'arraybuffer' });
          data = new Uint8Array(response.data);
          console.log('파일 다운로드 완료.');
        } catch (downloadError) {
          console.error('파일 다운로드 실패:', downloadError);
          throw new Error('PDF 파일을 다운로드할 수 없습니다.');
        }
      }
    }

    // 최종적으로 data가 Buffer라면 Uint8Array로 변환
    if (Buffer.isBuffer(data)) {
      data = new Uint8Array(data);
    }

    const loadingTask = getDocument(data);

    try {
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;
      const allTextChunks: RawPdfChunk[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const strings: string[] = [];
        for (const item of textContent.items) {
          if ('str' in item) {
            strings.push(item.str);
          }
        }

        const pageText = strings.join(' ');

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