import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// Validate body
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const details = err.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request payload: ' + details.map(d => `${d.field}: ${d.message}`).join('; '),
          details,
          requestId: req.requestId
        });
        return;
      }
      next(err);
    }
  };
}

// Validate query
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const details = err.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters: ' + details.map(d => `${d.field}: ${d.message}`).join('; '),
          details,
          requestId: req.requestId
        });
        return;
      }
      next(err);
    }
  };
}
