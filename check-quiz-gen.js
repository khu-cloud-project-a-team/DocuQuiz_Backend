require('dotenv').config();
const { Client } = require('pg');

async function testQuizGeneration() {
    console.log('=== 퀴즈 생성 API 테스트 ===');

    const client = new Client({
        host: '127.0.0.1',
        port: 5435,
        user: 'zmfvmfdocuquiz',
        password: 'simplepass',
        database: 'docuquiz',
    });

    try {
        await client.connect();

        // 1. 최신 파일 조회
        const files = await client.query('SELECT id, "originalName", "s3Url" FROM file_entity ORDER BY "createdAt" DESC LIMIT 1');
        if (files.rows.length === 0) {
            console.log('❌ 업로드된 파일이 없습니다.');
            return;
        }
        const latestFile = files.rows[0];
        console.log(`📂 대상 파일: ${latestFile.originalName}`);
        console.log(`🔗 S3 URL: ${latestFile.s3Url}`);

        // 2. API 호출
        const apiUrl = 'http://localhost:3000/quiz/generate';
        const payload = {
            filePath: latestFile.s3Url,
            options: {
                questionCount: 3,
                types: ['객관식'],
                difficulty: '보통'
            }
        };

        console.log(`\n🚀 API 호출 중... (${apiUrl})`);
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('\n✅ 퀴즈 생성 성공!');
            console.log(`📝 퀴즈 제목: ${data.title}`);
            console.log(`❓ 문항 수: ${data.questions.length}`);
            console.log(JSON.stringify(data.questions[0], null, 2)); // 첫 번째 문제 출력
        } else {
            console.error(`\n❌ API 호출 실패: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('응답 내용:', errorText);
        }

    } catch (err) {
        console.error('\n❌ 오류 발생:', err);
    } finally {
        await client.end();
    }
}

testQuizGeneration();
