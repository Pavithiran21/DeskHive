import { IconAlertCircle } from '@tabler/icons-react';
import { useId } from 'react';

/** The red message under a field, with the id the input points to (aria-describedby). */
export function FieldError({ id, message }) {
  if (!message) {
    return null;
  }
  return (
    <div className="ferr" id={id}>
      <IconAlertCircle aria-hidden="true" />
      {message}
    </div>
  );
}

function describedBy(error, errorId, hint, hintId) {
  return [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
}

/**
 * A labelled input for React Hook Form: <TextField label="Work email" error={errors.email?.message}
 * {...register('email')} />. Errors use aria-invalid and aria-describedby.
 */
export function TextField({ label, error, hint, className = '', ref, ...inputProps }) {
  const id = useId();
  const errorId = `${id}-e`;
  const hintId = `${id}-h`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        className={`inp ${error ? 'bad' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, hint, hintId)}
        {...inputProps}
      />
      <FieldError id={errorId} message={error} />
      {hint && !error && (
        <div className="hint" id={hintId}>
          {hint}
        </div>
      )}
    </>
  );
}

/** A labelled native select. options: [{ value, label }] */
export function SelectField({ label, error, hint, options, className = '', ref, ...selectProps }) {
  const id = useId();
  const errorId = `${id}-e`;
  const hintId = `${id}-h`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select
        ref={ref}
        id={id}
        className={`inp ${error ? 'bad' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(error, errorId, hint, hintId)}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
      {hint && !error && (
        <div className="hint" id={hintId}>
          {hint}
        </div>
      )}
    </>
  );
}
