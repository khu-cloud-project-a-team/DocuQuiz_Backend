require('dotenv').config();
const { Client } = require('pg');

async function checkPdfChunks() {
    console.log('=== PDF Chunk 및 구조화 확인 ===');

    const client = new Client({
        host: '127.0.0.1',
        port: 5435,
        user: 'zmfvmfdocuquiz',
        password: 'simplepass',
        database: 'docuquiz',
    });

    try {
        await client.connect();
        console.log('✅ DB Connected.');

        // 1. Check File Entity
        console.log('\n--- 📂 Latest Uploaded Files ---');
        const files = await client.query('SELECT id, "originalName", "createdAt" FROM file_entity ORDER BY "createdAt" DESC LIMIT 1');
        if (files.rows.length === 0) {
            console.log('No files found. Please upload a PDF first.');
            return;
        }
        const latestFile = files.rows[0];
        console.log(`[${latestFile.createdAt.toISOString()}] ${latestFile.originalName} (ID: ${latestFile.id})`);

        // 2. Check Pdf Chunks for the file
        console.log(`\n--- 📄 PDF Chunks for File ID: ${latestFile.id} ---`);
        const chunks = await client.query('SELECT id, "pageNumber", type, left(content, 50) as preview FROM pdf_chunk_entity WHERE "fileId" = $1 ORDER BY "pageNumber" ASC', [latestFile.id]);

        if (chunks.rows.length === 0) {
            console.log('No chunks found for this file.');
        } else {
            console.log(`Found ${chunks.rows.length} chunks.`);
            chunks.rows.forEach(row => {
                console.log(`  Page ${row.pageNumber} [${row.type}]: ${row.preview}...`);
            });
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.end();
    }
}

checkPdfChunks();
