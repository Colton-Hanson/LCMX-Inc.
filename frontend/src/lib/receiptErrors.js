// Turns a failed receipt call into { code, message, action }: what went wrong and what to do next.

const FALLBACK_ACTION = 'Please try again.';

// Messages for errors the backend doesn't explain.
function fromStatus(result, fallbackMessage) {
  if (result.network) {
    return { code: 'network', message: 'We couldn’t reach the server.', action: 'Check your connection and try again.' };
  }
  if (result.status === 401) {
    return { code: 'signed_out', message: 'Your session has ended.', action: 'Log in again, then try again.' };
  }
  if (result.status === 429) {
    return { code: 'too_many', message: 'Too many attempts.', action: 'Wait a moment and try again.' };
  }
  if (result.status >= 500) {
    return { code: 'server', message: 'Something went wrong on our end.', action: 'Try again in a moment.' };
  }
  const detail = result.data?.detail;
  if (typeof detail === 'string' && detail) {
    return { code: result.status === 404 ? 'not_found' : 'refused', message: detail, action: FALLBACK_ACTION };
  }
  if (Array.isArray(detail)) {
    // Validation errors come as a list that starts with "Value error, ", so that part gets cut.
    const text = detail
      .map((item) => String(item?.msg ?? '').replace(/^Value error,\s*/, ''))
      .filter(Boolean)
      .join(' ');
    return { code: 'invalid', message: text || fallbackMessage, action: FALLBACK_ACTION };
  }
  return { code: 'unknown', message: fallbackMessage, action: FALLBACK_ACTION };
}

// Backend upload limit is 10 MB. Its message doesn't say the size, so we add it.
export const TOO_LARGE_MESSAGE = 'This file is too large (max 10 MB).';

// Error for a failed upload.
export function uploadErrorFromResult(result) {
  const detail = result.data?.detail;
  if (!result.network && detail && typeof detail === 'object' && !Array.isArray(detail) && detail.code) {
    return {
      code: detail.code,
      message: detail.code === 'file_too_large' ? TOO_LARGE_MESSAGE : detail.message || 'The receipt could not be uploaded.',
      action: detail.action || FALLBACK_ACTION,
    };
  }
  // Any other server error ends up here.
  return fromStatus(result, 'The receipt could not be uploaded.');
}
