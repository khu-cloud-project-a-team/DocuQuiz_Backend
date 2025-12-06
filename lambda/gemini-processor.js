const { GoogleGenerativeAI } = require('@google/generative-ai');

async function structureText(rawChunks, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const structuredChunks = [];

    for (const chunk of rawChunks) {
        // 프롬프트: 텍스트를 구조화된 JSON으로 변환
        const prompt = `
        [Role]
        You are a PDF document analyzer.
        
        [Task]
        Analyze the following text and classify it into structural components.
        Return the result as a JSON array.
        
        [Input Text]
        ${chunk.content}
        
        [Output Format]
        [
          { "type": "header", "content": "..." },
          { "type": "paragraph", "content": "..." },
          { "type": "list", "content": "..." },
          { "type": "table", "content": "..." }
        ]
        
        [Rules]
        1. 'type' must be one of: 'header', 'paragraph', 'list', 'table'.
        2. Do not include markdown formatting (like \`\`\`json).
        3. Keep the content exactly as it is in the text.
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // JSON 파싱 (마크다운 제거)
            const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const items = JSON.parse(jsonText);

            items.forEach(item => {
                structuredChunks.push({
                    page: chunk.page,
                    type: item.type,
                    content: item.content
                });
            });

        } catch (e) {
            console.error('Gemini Analysis Error:', e);
            // 에러 시 원본 텍스트를 'unknown' 타입으로 저장
            structuredChunks.push({
                page: chunk.page,
                type: 'unknown',
                content: chunk.content
            });
        }
    }

    return structuredChunks;
}

module.exports = { structureText };
