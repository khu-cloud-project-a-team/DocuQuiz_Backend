import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 허용
  app.enableCors({
    credentials: true,
    origin: [
      'https://docuquiz.win',       // 기본 도메인
      'https://www.docuquiz.win',   // www 포함 도메인
      'http://localhost:3000',      // 로컬 개발용 (필요 시)
    ],
  });


  await app.listen(3000);
}
bootstrap();
