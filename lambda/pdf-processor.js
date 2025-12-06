const pdf = require('pdf-parse');

async function extractRawText(pdfBuffer) {
    try {
        // pdf-parse를 사용하여 텍스트 추출
        const data = await pdf(pdfBuffer);

        // 전체 텍스트를 반환 (페이지 구분 없이)
        // 만약 페이지별 처리가 필요하다면 pdf-parse의 고급 옵션이나 다른 라이브러리 필요
        // 현재 백엔드 로직과 동일하게 전체 텍스트를 기반으로 처리

        // *참고*: 백엔드에서는 페이지별로 나누는 로직이 있었으나, 
        // pdf-parse 기본 사용 시 전체 텍스트가 합쳐져서 나옴.
        // 여기서는 편의상 전체를 1페이지로 취급하거나,
        // Gemini에게 텍스트를 통째로 넘겨서 구조화하도록 함.

        return [{ page: 1, content: data.text }];

    } catch (error) {
        console.error('PDF Extraction Error:', error);
        throw error;
    }
}

module.exports = { extractRawText };
