import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../constants/error-codes.constant';

/**
 * Domain/business exception carrying a stable machine-readable error code,
 * so clients can branch on `error.code` instead of parsing messages.
 */
export class AppException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}
