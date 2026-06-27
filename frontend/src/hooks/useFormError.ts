import { useState, useCallback } from 'react';

export interface ApiErrorResponse {
  success?: boolean;
  error?: string;
  message?: string;
  errors?: Record<string, string[] | string>;
}

/**
 * Reusable hook to handle and display field-level and general form validation errors.
 */
export function useFormError() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleApiError = useCallback((error: unknown): boolean => {
    setFieldErrors({});
    setGeneralError(null);

    if (!error) return false;

    const errRes = error as ApiErrorResponse;

    // Map field-specific errors (typically from 422 validations)
    if (errRes.errors && typeof errRes.errors === 'object') {
      const mapped: Record<string, string> = {};
      Object.entries(errRes.errors).forEach(([field, msgs]) => {
        if (Array.isArray(msgs) && msgs.length > 0) {
          mapped[field] = msgs[0];
        } else if (typeof msgs === 'string') {
          mapped[field] = msgs;
        }
      });
      setFieldErrors(mapped);
      return true;
    }

    // Map general API error messages
    if (errRes.error || errRes.message) {
      setGeneralError(errRes.error || errRes.message || null);
      return true;
    }

    return false;
  }, []);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setGeneralError(null);
  }, []);

  return {
    fieldErrors,
    generalError,
    handleApiError,
    clearErrors,
    setFieldErrors,
    setGeneralError,
  };
}
