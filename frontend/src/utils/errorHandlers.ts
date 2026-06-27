import { ERROR_MESSAGES } from '../constants/errorMessages';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Filter out noise from browser extensions, third-party analytics/ads, or standard dev tools.
 */
function shouldFilterError(message: string, source?: string): boolean {
  if (!message) return false;
  const lowercaseMsg = message.toLowerCase();
  
  // Extension noise
  if (
    source?.includes('chrome-extension://') || 
    source?.includes('safari-extension://') || 
    source?.includes('moz-extension://') ||
    lowercaseMsg.includes('extension') ||
    lowercaseMsg.includes('safari-extension')
  ) {
    return true;
  }
  
  // Third-party scripts (e.g. analytics, doubleclick, browser extensions)
  if (
    source && 
    (source.includes('googlesyndication') || 
     source.includes('doubleclick') || 
     source.includes('google-analytics') || 
     source.includes('facebook') || 
     source.includes('sentry'))
  ) {
    return true;
  }
  
  // Generic script error (usually CORS issues on third-party scripts)
  if (lowercaseMsg === 'script error') {
    return true;
  }
  
  return false;
}

/**
 * Maps any error object or status code to a friendly message from the map.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return ERROR_MESSAGES.fallback;
  
  if (typeof error === 'string') {
    return error;
  }

  // Handle status code responses directly
  if (typeof error.status === 'number' || typeof error.status === 'string') {
    const status = Number(error.status);
    if (status in ERROR_MESSAGES) {
      return ERROR_MESSAGES[status as keyof typeof ERROR_MESSAGES];
    }
  }

  // Network/Fetch errors
  const message = error.message || '';
  const name = error.name || '';

  if (
    message.includes('Failed to fetch') || 
    message.includes('NetworkError') || 
    message.includes('network error') ||
    name === 'TypeError' && message.includes('fetch')
  ) {
    return ERROR_MESSAGES.NetworkError;
  }
  
  if (message.includes('timeout') || name === 'AbortError' || message.includes('aborted')) {
    return ERROR_MESSAGES.timeout;
  }
  
  if (message.includes('CORS') || message.includes('cross-origin')) {
    return ERROR_MESSAGES.cors;
  }

  if (name === 'ChunkLoadError' || message.includes('Loading chunk')) {
    return ERROR_MESSAGES.ChunkLoadError;
  }
  
  // Specific JS runtime errors
  if (error instanceof TypeError) {
    return ERROR_MESSAGES.TypeError;
  }
  
  if (error instanceof ReferenceError) {
    return ERROR_MESSAGES.ReferenceError;
  }
  
  return error.message || ERROR_MESSAGES.fallback;
}

/**
 * Initializes global error listeners and intercepts window.fetch requests.
 */
export function initializeGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  // 1. Uncaught Runtime Errors
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMsg = typeof message === 'string' ? message : message.toString();
    if (shouldFilterError(errorMsg, source)) return;

    const friendlyMessage = getFriendlyErrorMessage(error || new Error(errorMsg));
    
    // Push notification toast
    useNotificationStore.getState().error("Application Error", friendlyMessage);
    
    // Log the real error to the console silently (collapsed for clean console)
    console.groupCollapsed('%c[ManaSarathi Global Error]', 'color: #c85a5a; font-weight: bold;', errorMsg);
    console.error(error || { message, source, lineno, colno });
    console.groupEnd();
  };

  // 2. Unhandled Promise Rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    
    // Skip if aborted requests or normal user navigations
    if (reason?.name === 'AbortError' || reason?.message?.includes('aborted')) {
      return;
    }

    const friendlyMessage = getFriendlyErrorMessage(reason);
    useNotificationStore.getState().error("Connection Issue", friendlyMessage);

    console.groupCollapsed('%c[ManaSarathi Promise Rejection]', 'color: #d4a574; font-weight: bold;', reason?.message || reason);
    console.error(reason);
    console.groupEnd();
  });

  // 3. Global window.fetch Interception
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      const response = await originalFetch(input, init);
      
      if (!response.ok) {
        let serverError = '';
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          serverError = data?.error || data?.message || '';
        } catch {
          // If response is not JSON, ignore parsing
        }

        const friendlyMessage = getFriendlyErrorMessage({
          status: response.status,
          message: serverError
        });

        // 422 Unprocessable Entity represents validation errors, handled inline on forms.
        // We skip showing toasts for validation errors to prevent toast clutter.
        if (response.status !== 422) {
          useNotificationStore.getState().error(
            response.status >= 500 ? "Server Issue" : "Request Failed",
            friendlyMessage
          );
        }
      }
      
      return response;
    } catch (error: any) {
      // Catch network-level errors (offline, CORS, timeouts)
      let friendlyMessage: string = ERROR_MESSAGES.NetworkError;
      if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
        friendlyMessage = ERROR_MESSAGES.timeout;
      }

      useNotificationStore.getState().error("Connection Error", friendlyMessage);
      throw error;
    }
  };
}
