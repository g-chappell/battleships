import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { FONT_STYLES } from '../../styles/fonts';
import { Input } from '../shadcn/input';
import { Label } from '../shadcn/label';
import { Textarea } from '../shadcn/textarea';

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

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <Label htmlFor={fieldId} style={FONT_STYLES.labelSC}>
          {label}
        </Label>
      )}
      {multiline ? (
        <Textarea
          id={fieldId}
          name={name}
          rows={rows ?? 3}
          style={FONT_STYLES.body}
          {...(rest as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <Input
          id={fieldId}
          name={name}
          style={FONT_STYLES.body}
          {...rest}
        />
      )}
      {error && (
        <p className="text-destructive text-xs mt-1 italic" style={FONT_STYLES.body}>
          {error}
        </p>
      )}
    </div>
  );
}
