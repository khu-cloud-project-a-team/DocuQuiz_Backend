const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { extractRawText } = require('./pdf-processor');
const { structureText } = require('./gemini-processor');
const { getDbClient } = require('./db');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Event Received:', JSON.stringify(event, null, 2));

    // S3 이벤트에서 버킷명과 파일 키 추출
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    try {
        // 1. S3에서 PDF 파일 다운로드
        console.log(`Downloading ${key} from ${bucket}...`);
        const getObjectParams = {
            Bucket: bucket,
            Key: key,
        };
        const response = await s3Client.send(new GetObjectCommand(getObjectParams));

        // Stream을 Buffer로 변환
        const streamToBuffer = (stream) =>
            new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', (chunk) => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });

        const pdfBuffer = await streamToBuffer(response.Body);

        // 2. 텍스트 추출 (pdf-processor.js)
        console.log('Extracting text...');
        const rawChunks = await extractRawText(pdfBuffer);

        // 3. Gemini로 구조화 분석 (gemini-processor.js)
        console.log('Analyzing with Gemini...');
        const structuredChunks = await structureText(rawChunks, process.env.GEMINI_API_KEY);

        // 4. DB 저장 (db.js)
        console.log('Saving to DB...');
        const client = await getDbClient();

        // file_entity에서 fileId 찾기 (s3Key로 조회)
        // confirmUpload API가 호출되어 file_entity가 생성될 때까지 대기
        let fileId = null;
        const maxRetries = 5;
        const retryDelay = 2000; // 2초

        for (let i = 0; i < maxRetries; i++) {
            const fileRes = await client.query('SELECT id FROM file_entity WHERE "s3Key" = $1', [key]);

            if (fileRes.rows.length > 0) {
                fileId = fileRes.rows[0].id;
                console.log(`File found in DB (attempt ${i + 1}): ${fileId}`);
                break;
            }

            console.log(`File not found (attempt ${i + 1}/${maxRetries}), waiting ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        if (!fileId) {
            console.error(`File entity not found after ${maxRetries} attempts for key: ${key}`);
            throw new Error(`File entity not found for key: ${key}`);
        }

        // 청크 저장
        for (const chunk of structuredChunks) {
            await client.query(
                'INSERT INTO pdf_chunk_entity ("content", "pageNumber", "type", "fileId", "createdAt") VALUES ($1, $2, $3, $4, NOW())',
                [chunk.content, chunk.page, chunk.type, fileId]
            );
        }

        console.log(`Successfully saved ${structuredChunks.length} chunks.`);

        return { statusCode: 200, body: 'Success' };

    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: error.message };
    }
};
