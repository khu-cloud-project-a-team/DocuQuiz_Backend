import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { QuizModule } from './quiz/quiz.module';

@Module({
  imports: [CoreModule, QuizModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
