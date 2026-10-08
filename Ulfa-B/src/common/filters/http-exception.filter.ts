import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, any>).message || exceptionResponse
        : exceptionResponse;

    const exceptionDetails =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, any>)
        : undefined;

    const errorResponse = {
      success: false,
      statusCode: status,
      message,
      ...(exceptionDetails?.code ? { code: exceptionDetails.code } : {}),
      ...(exceptionDetails?.requested !== undefined
        ? { requested: exceptionDetails.requested }
        : {}),
      ...(exceptionDetails?.available !== undefined
        ? { available: exceptionDetails.available }
        : {}),
      ...(exceptionDetails?.reason !== undefined
        ? { reason: exceptionDetails.reason }
        : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : '',
    );

    response.status(status).json(errorResponse);
  }
}
