import React from 'react';
import { cn } from './utils';

interface FormErrorProps {
  message?: string;
  className?: string;
}

/**
 * Reusable field-level error message component.
 * Ensures consistent animation, typography, and styling for validation messages.
 */
export const FormError: React.FC<FormErrorProps> = ({ message, className }) => {
  if (!message) return null;

  return (
    <p
      className={cn('text-sm text-destructive mt-1 animate-slide-in', className)}
      role="alert"
    >
      {message}
    </p>
  );
};
