// Turns a failed API result ({ ok: false, status, data, network }) into a message for the user.
// `fallback` is shown when the server gave no usable detail.
export function messageFromResult(result, fallback) {
  if (result.network) return 'We couldn’t reach the server. Check your connection and try again.';
  if (result.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (result.status >= 500) return 'Something went wrong on our end. Please try again in a moment.';

  const detail = result.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // Validation errors arrive as a list; messages start with "Value error, " which is not user-friendly.
    const text = detail
      .map((item) => String(item?.msg ?? '').replace(/^Value error,\s*/, ''))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }
  return fallback;
}
