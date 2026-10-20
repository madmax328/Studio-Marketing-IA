import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-border bg-black/30 px-3.5 py-2.5 text-sm text-foreground transition placeholder:text-muted/70 hover:border-border-strong focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:opacity-60";

interface FieldProps {
  label: string;
  name: string;
  hint?: ReactNode;
}

export function TextField({ label, name, hint, className, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground/90">
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
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground/90">
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
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-foreground/90">
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
