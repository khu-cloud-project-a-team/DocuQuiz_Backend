require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function verifyFlashLatest() {
    console.log('--- Verifying gemini-flash-latest with JSON Mode ---');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ Error: GEMINI_API_KEY not found in .env');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Using the exact model name found in the list
        const modelName = 'gemini-flash-latest';

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: 'application/json' }
        });

        console.log(`Sending request to ${modelName}...`);
        const result = await model.generateContent('List 3 animals in JSON array format.');
        const response = await result.response;
        const text = response.text();

        console.log(`\nResponse from ${modelName}:`);
        console.log(text);

        // Validate JSON
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`\n✅ Success! ${modelName} is working and returned valid JSON.`);
        } else {
            console.log('\n⚠️ Warning: Parsed JSON is valid but might not be an array as expected.');
        }

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
    }
}

verifyFlashLatest();
