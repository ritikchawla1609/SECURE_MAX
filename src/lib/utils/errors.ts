export class SecureMaxError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(message: string, code: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'SecureMaxError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const authRequired = (msg = 'Authentication required', details?: any) =>
  new SecureMaxError(msg, 'UNAUTHORIZED', 401, details);

export const permissionDenied = (msg = 'Permission denied', details?: any) =>
  new SecureMaxError(msg, 'FORBIDDEN', 403, details);

export const resourceNotFound = (msg = 'Resource not found', details?: any) =>
  new SecureMaxError(msg, 'NOT_FOUND', 404, details);

export const blockchainUnavailable = (msg = 'Blockchain node unavailable', details?: any) =>
  new SecureMaxError(msg, 'SERVICE_UNAVAILABLE', 503, details);

export const kmsUnavailable = (msg = 'KMS unavailable or missing keys', details?: any) =>
  new SecureMaxError(msg, 'KMS_UNAVAILABLE', 503, details);

export const accessExpired = (msg = 'Access expired or invalid', details?: any) =>
  new SecureMaxError(msg, 'ACCESS_EXPIRED', 401, details);

export const rateLimited = (msg = 'Too many requests', details?: any) =>
  new SecureMaxError(msg, 'RATE_LIMITED', 429, details);

export const validationError = (msg = 'Validation failed', details?: any) =>
  new SecureMaxError(msg, 'VALIDATION_ERROR', 400, details);

export const internalError = (msg = 'Internal server error', details?: any) =>
  new SecureMaxError(msg, 'INTERNAL_ERROR', 500, details);
