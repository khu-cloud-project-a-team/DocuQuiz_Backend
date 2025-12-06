const { Client } = require('pg');

// Lambda 환경 변수에서 DB 접속 정보 로드
const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false } // AWS RDS 등 외부 접속 시 필요할 수 있음
});

let isConnected = false;

async function getDbClient() {
    if (!isConnected) {
        await client.connect();
        isConnected = true;
        console.log('DB Connected');
    }
    return client;
}

module.exports = { getDbClient };
