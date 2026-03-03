import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    status: number;
  };
  requestId: string | null;
  timestamp: string;
  method: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "Unexpected server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const data = exceptionResponse as {
          message?: string | string[];
          error?: string;
        };
        if (Array.isArray(data.message)) {
          message = data.message.join(", ");
        } else if (typeof data.message === "string") {
          message = data.message;
        }
        if (typeof data.error === "string") {
          code = data.error.toUpperCase().replaceAll(" ", "_");
        } else {
          code = HttpStatus[status] ?? code;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        code = "UNIQUE_CONSTRAINT_VIOLATION";
        message = "Unique constraint violation.";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        code = "RECORD_NOT_FOUND";
        message = "Requested record was not found.";
      } else if (exception.code === "P2003") {
        status = HttpStatus.CONFLICT;
        code = "FOREIGN_KEY_CONSTRAINT_VIOLATION";
        message = "Related record constraint failed.";
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = "DATABASE_REQUEST_ERROR";
        message = "Database request could not be completed.";
      }
    }

    const body: ErrorBody = {
      success: false,
      error: {
        code,
        message,
        status
      },
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.url
    };

    response.status(status).json(body);
  }
}
