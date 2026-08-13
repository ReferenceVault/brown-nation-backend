import { BadRequestException, ValidationError } from '@nestjs/common';

import { ErrorCode } from '../constants/error-codes.constant';

interface FieldError {
  field: string;
  errors: string[];
}

function flattenErrors(errors: ValidationError[], parentPath = ''): FieldError[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const fieldErrors: FieldError[] = [];

    if (error.constraints) {
      fieldErrors.push({ field: path, errors: Object.values(error.constraints) });
    }

    if (error.children && error.children.length > 0) {
      fieldErrors.push(...flattenErrors(error.children, path));
    }

    return fieldErrors;
  });
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const details = flattenErrors(errors);

  return new BadRequestException({
    code: ErrorCode.VALIDATION_ERROR,
    message: 'Validation failed',
    details,
  });
}
