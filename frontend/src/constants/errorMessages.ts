/**
 * Centralized error messages map.
 * Maps HTTP status codes, runtime exception types, and connection statuses
 * to user-friendly, plain-language text.
 */
export const ERROR_MESSAGES = {
  // HTTP status codes
  400: "We couldn't process this request. Please check your information and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You don't have permission to access this resource.",
  404: "The requested resource could not be found.",
  405: "This action is not supported by the server.",
  408: "The request timed out. Please check your connection.",
  409: "There is a conflict with this request. Please refresh and try again.",
  422: "Some of the provided information is invalid. Please check the fields below.",
  429: "Too many requests. Please wait a moment before trying again.",
  500: "Our servers are experiencing an issue. Please try again in a few minutes.",
  502: "We are having trouble connecting to the service. Please try again shortly.",
  503: "The service is temporarily unavailable. We're working on it!",
  504: "The server took too long to respond. Please try again.",

  // JS runtime error names
  TypeError: "An unexpected application error occurred. We're looking into it.",
  ReferenceError: "An unexpected application error occurred. We're looking into it.",
  NetworkError: "A network error occurred. Please check your internet connection.",
  ChunkLoadError: "A new version of the application is available. Please reload the page.",

  // Custom states
  offline: "You're offline. Please check your internet connection.",
  timeout: "The request timed out. Please try again.",
  cors: "Secure communication with the server failed. Please try again later.",
  
  // Generic fallback
  fallback: "Something went wrong. Please try again or contact support if the issue persists."
} as const;
