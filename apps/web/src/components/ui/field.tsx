import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary";

interface FieldProps {
  label: string;
  name: string;
  hint?: ReactNode;
}

export function TextField({ label, name, hint, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input id={name} name={name} className={cn(control, className)} {...props} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <textarea id={name} name={name} rows={3} className={cn(control, className)} {...props} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
}: FieldProps & { options: { value: string; label: string }[]; defaultValue?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className={control}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
