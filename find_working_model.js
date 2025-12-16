require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function findWorkingModel() {
    console.log('--- Hunting for a Working Gemini Model (JSON Mode) ---');

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    const candidates = [
        'gemini-1.5-flash-8b',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
        'gemini-flash-lite-latest',
        'gemini-2.0-flash-lite-preview-02-05',
        'gemini-2.0-flash-exp',
    ];

    for (const modelName of candidates) {
        console.log(`\nTesting ${modelName} with JSON mode...`);
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' }
            });

            const prompt = 'List 3 fruits in JSON array format.';
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`✅ FOUND ONE! ${modelName} is working!`);
            console.log(`Response: ${text}`);

            try {
                JSON.parse(text);
                console.log('Valid JSON parsed.');
                return;
            } catch (jsonErr) {
                console.log('❌ output was not valid JSON.');
            }

        } catch (e) {
            let msg = e.message;
            if (msg.includes('429')) msg = '429 Quota Exceeded';
            if (msg.includes('404')) msg = '404 Not Found';
            console.log(`❌ Failed: ${msg}`);
        }
    }
    console.log('\n❌ All candidates failed.');
}

findWorkingModel();
