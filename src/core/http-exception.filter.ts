import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const error = exception.getResponse() as
      | string
      | { error: string; statusCode: number; message: string | string[] };

    response.header('Access-Control-Allow-Origin', 'https://docuquiz.win');
    response.header('Access-Control-Allow-Credentials', 'true');

    if (typeof error === 'string') {
      response.status(status).json({
        statusCode: status,
        error: error,
      });
    } else {
      response.status(status).json({
        ...error,
        statusCode: status,
      });
    }
  }
}
