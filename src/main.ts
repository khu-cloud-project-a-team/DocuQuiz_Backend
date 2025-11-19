// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // ⬇️ 이 부분을 추가하세요 (CORS 허용)
  app.enableCors(); 
  
  await app.listen(3000);
}
bootstrap();