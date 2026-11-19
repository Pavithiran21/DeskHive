import { z } from 'zod';

// Client-side checks with the same words as the server (UI-UX.md "Validation messages").
// The server checks everything again; these only save a round trip.

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your work email.')
  .pipe(z.email('Enter a valid email, like name@company.com.'));

export const newPasswordField = z
  .string()
  .min(8, 'Use at least 8 characters, with a number.')
  .regex(/\d/, 'Use at least 8 characters, with a number.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Use at most 72 characters.');

export const nameField = z.string().trim().min(1, 'Enter your name.').max(80, 'Use at most 80 characters.');

/** Adds "Passwords don't match." to a schema with password and confirm fields. */
export function withConfirm(schema, field = 'password') {
  return schema.refine((values) => values[field] === values.confirm, {
    message: "Passwords don't match.",
    path: ['confirm'],
  });
}
