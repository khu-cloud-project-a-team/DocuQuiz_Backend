import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 허용
  // app.enableCors({
  //   credentials: true,
  //   origin: true,
  // });


  await app.listen(3000);
}
bootstrap();
