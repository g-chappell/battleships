import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { FONT_STYLES } from '../../styles/fonts';

interface BaseFieldProps {
  label?: string;
  error?: string | null;
  /** Render as a textarea instead of input. */
  multiline?: boolean;
  rows?: number;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, keyof BaseFieldProps> & BaseFieldProps;

/**
 * Standardized form field with label + input styling.
 *
 * Use for all form inputs (auth, create clan, create tournament, settings).
 * Inputs use dark pitch background, blood-red border, bone text.
 */
export function FormField({
  label,
  error,
  multiline,
  rows,
  className = '',
  id,
  name,
  ...rest
}: InputProps) {
  const fieldId = id ?? name;
  const inputBase =
    'w-full px-4 py-2 bg-pitch border border-blood/40 rounded text-bone placeholder-parchment/30 focus:border-blood-bright focus:outline-none transition-colors';

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-parchment text-xs uppercase tracking-wider mb-1"
          style={FONT_STYLES.labelSC}
        >
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          id={fieldId}
          name={name}
          rows={rows ?? 3}
          className={`${inputBase} resize-none`}
          style={FONT_STYLES.body}
          {...(rest as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          className={inputBase}
          style={FONT_STYLES.body}
          {...rest}
        />
      )}
      {error && (
        <p className="text-blood-bright text-xs mt-1 italic" style={FONT_STYLES.body}>
          {error}
        </p>
      )}
    </div>
  );
}
