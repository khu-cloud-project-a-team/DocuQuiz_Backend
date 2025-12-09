import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/http-exception.filter.ts';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS 허용
  // app.enableCors({
  //   origin: 'https://docuquiz.win',
  //   credentials: true,
  // });


  await app.listen(3000);
}
bootstrap();
