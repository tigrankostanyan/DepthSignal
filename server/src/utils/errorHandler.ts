import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Error handler
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  const requestId = req.requestId || 'req_unknown';
  const safeError: any = err instanceof Error ? err : new Error(String(err ?? 'An unexpected internal error occurred'));
  let statusCode = Number(safeError.statusCode || safeError.status || 500);
  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }
  let errorCode = safeError.code || 'INTERNAL_SERVER_ERROR';
  let message = safeError.message || 'An unexpected internal error occurred';
  let details = safeError.details || undefined;

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

  // Internal logging with correlation ID (expected 4xx auth states are not logged)
  if (statusCode >= 500) {
    console.error(`[Error] [${requestId}] [${statusCode}] ${errorCode}: ${safeError.message}`, {
      url: req.originalUrl,
      method: req.method,
      user: req.user?.id,
      stack: process.env.NODE_ENV !== 'production' ? safeError.stack : undefined
    });
  }

  // Never expose raw stack traces in responses
  res.status(statusCode).json({
    error: errorCode,
    message,
    statusCode,
    details,
    requestId
  });
}
