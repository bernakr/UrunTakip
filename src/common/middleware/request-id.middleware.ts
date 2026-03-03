import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const incomingRequestId = request.header("x-request-id");
  const requestId =
    typeof incomingRequestId === "string" && incomingRequestId.trim().length > 0
      ? incomingRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}

