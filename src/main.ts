import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 허용
  app.enableCors();

  // Swagger 설정 (비활성화됨)
  // const config = new DocumentBuilder()
  //   .setTitle('DocuQuiz API')
  //   .setDescription('DocuQuiz 백엔드 API 문서')
  //   .setVersion('1.0')
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();