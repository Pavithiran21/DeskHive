// Where an API error is shown (UI-UX.md "Errors by code"). Every message from the server is already
// written for the person, so screens show error.message and use error.code only to choose the place.

/** Codes shown inline under a field (details[].field names the field). */
const FIELD_CODES = new Set([
  'VALIDATION_FAILED',
  'SPACE_EXISTS',
  'FLOOR_EXISTS',
  'OFFICE_EXISTS',
  'WRONG_PASSWORD',
  'INVALID_CREDENTIALS',
]);

/** Codes that replace the whole page (the Errors screen). */
const PAGE_CODES = new Set(['INVITE_NOT_VALID', 'RESET_LINK_EXPIRED', 'NOT_FOUND', 'FORBIDDEN']);

export function isPageError(error) {
  return PAGE_CODES.has(error?.code) || error?.status === 404 || error?.status === 403;
}

/** A 5xx or no answer at all: the "Something went wrong" panel with Try again and the request id. */
export function isServerError(error) {
  return !error || error.status === 0 || error.status >= 500;
}

/**
 * Puts a server error under the form fields it names (React Hook Form's setError) and focuses the
 * first one. fieldMap maps an API field name to the form's own name when they differ.
 * Returns true when the error was placed inline, false when the caller has to show it elsewhere.
 */
export function applyFieldErrors(error, setError, { fieldMap = {}, fallbackField } = {}) {
  if (!FIELD_CODES.has(error?.code)) {
    return false;
  }
  const fieldDetails = (error.details ?? []).filter((entry) => entry.field);
  if (fieldDetails.length) {
    fieldDetails.forEach((entry, index) => {
      const name = fieldMap[entry.field] ?? entry.field;
      setError(name, { type: 'server', message: entry.message }, { shouldFocus: index === 0 });
    });
    return true;
  }
  // No field named (for example INVALID_CREDENTIALS on Log in): it goes under the fallback field.
  if (fallbackField) {
    setError(fallbackField, { type: 'server', message: error.message }, { shouldFocus: true });
    return true;
  }
  return false;
}

/**
 * The first sentence of a message in bold and the rest after it, as the design draws alerts:
 * "**Too many attempts.** Please wait a few minutes and try again."
 */
export function splitLead(message) {
  const text = message ?? '';
  const match = text.match(/^(.+?[.!?])\s+(.+)$/s);
  return match ? [match[1], match[2]] : [text, ''];
}
