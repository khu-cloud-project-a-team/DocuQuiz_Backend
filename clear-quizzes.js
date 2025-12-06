require('dotenv').config();
const { Client } = require('pg');

async function clearQuizzes() {
    console.log('=== 퀴즈 데이터 초기화 ===');

    const client = new Client({
        host: '127.0.0.1',
        port: 5435,
        user: 'zmfvmfdocuquiz',
        password: 'simplepass',
        database: 'docuquiz',
    });

    try {
        await client.connect();

        // 퀴즈 테이블 비우기 (Cascade로 연관 데이터도 삭제됨)
        await client.query('TRUNCATE TABLE quiz CASCADE');
        console.log('✅ 모든 퀴즈 데이터가 삭제되었습니다.');

    } catch (err) {
        console.error('❌ 오류 발생:', err);
    } finally {
        await client.end();
    }
}

clearQuizzes();
