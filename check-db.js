require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
    console.log('=== 환경 변수 확인 ===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***설정됨 (길이: ' + process.env.DB_PASSWORD.length + ')***' : '설정 안됨');
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('');

    const client = new Client({
        host: '127.0.0.1',
        port: 5435,
        user: 'zmfvmfdocuquiz',
        password: 'simplepass',
        database: 'docuquiz',
    });

    console.log('=== 데이터베이스 연결 시도 ===');
    try {
        await client.connect();
        console.log('✅ DB Connected.');

        // 1. Check Files
        console.log('\n--- 📂 Latest Uploaded Files ---');
        const files = await client.query('SELECT id, "originalName", "createdAt" FROM file_entity ORDER BY "createdAt" DESC LIMIT 3');
        if (files.rows.length === 0) console.log('No files found.');
        files.rows.forEach(row => {
            console.log(`[${row.createdAt.toISOString()}] ${row.originalName} (ID: ${row.id})`);
        });

        // 2. Check Quizzes
        console.log('\n--- 📝 Latest Quizzes ---');
        const quizzes = await client.query('SELECT id, title, "createdAt" FROM quiz ORDER BY "createdAt" DESC LIMIT 3');
        if (quizzes.rows.length === 0) console.log('No quizzes found.');
        quizzes.rows.forEach(row => {
            quizzes.rows.forEach(row => {
                console.log(`[${row.createdAt.toISOString()}]`);
                console.log(`  Title: ${row.title}`);
                console.log(`  ID: ${row.id}`);
            });
        });

        // 3. Check Quiz Results
        console.log('\n--- 🏆 Latest Quiz Results ---');
        const results = await client.query(`
      SELECT qr.id, qr.score, qr."correctQuestions", qr."totalQuestions", qr."createdAt", q.title 
      FROM quiz_result qr 
      LEFT JOIN quiz q ON qr."quizId" = q.id 
      ORDER BY qr."createdAt" DESC LIMIT 3
    `);
        if (results.rows.length === 0) console.log('No results found.');
        results.rows.forEach(row => {
            console.log(`[${row.createdAt.toISOString()}]`);
            console.log(`  Quiz: ${row.title}`);
            console.log(`  Score: ${row.score} (${row.correctQuestions}/${row.totalQuestions})`);
            console.log(`  ID: ${row.id}`);
            console.log(`  Quiz ID: ${row.quizId || 'N/A'}`); // quizId might not be in select, but let's check
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

checkDatabase();
