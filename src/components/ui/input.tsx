import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Form controls match cards and buttons: clean white fill, soft radius,
 * comfortable padding. Legibility over decoration.
 */

const FIELD_BASE =
  "w-full rounded-md border border-border bg-surface px-[14px] py-3 text-body-md text-secondary " +
  "placeholder:text-muted-text/70 transition-colors duration-150 " +
  "focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/40 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-text " +
  "aria-[invalid=true]:border-error aria-[invalid=true]:outline-error/30";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(FIELD_BASE, className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(FIELD_BASE, "min-h-24 resize-y", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(FIELD_BASE, "pr-9", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({
  className,
  children,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-label-md font-semibold text-secondary",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

/**
 * A labelled field. The label is always associated with the control so the
 * relationship survives a screen reader's form-navigation mode.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ms-1 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-body-sm text-muted-text">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="text-body-sm text-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
