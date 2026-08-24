import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || 'req_unknown';
  let statusCode = err.statusCode || err.status || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal error occurred';
  let details = err.details || undefined;

  // Handle specific error types
  if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    details = err.issues.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    message = 'Validation failed: ' + details.map(d => `${d.field}: ${d.message}`).join(', ');
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  }

  // Internal logging with correlation ID
  console.error(`[Error] [${requestId}] [${statusCode}] ${errorCode}: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  // Never expose raw stack traces in responses
  res.status(statusCode).json({
    error: errorCode,
    message,
    statusCode,
    details,
    requestId
  });
}
