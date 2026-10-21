import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render as a link while keeping button semantics for screen readers. */
  fullWidth?: boolean;
}

/**
 * Buttons follow Design.md exactly:
 *  - primary: teal background, 7px radius
 *  - secondary: white background, teal text, 7px radius
 *  - main (md) size is 47px tall with 15px/25px padding
 *
 * The primary label is the owner's own deep ink (`--color-tertiary`,
 * #3a3a3a) rather than white. White on the teal family measures 2.25:1
 * (rest), 1.92:1 (hover) and 1.66:1 (pressed) and fails WCAG 2.2 AA;
 * #3a3a3a measures 5.04:1, 5.92:1 and 6.86:1 on the same three teals. The
 * background is the brand colour and is not touched.
 *
 * The focus ring is `--color-primary-ink` (5.24:1 on white) rather than the
 * brand teal (2.25:1), so a focused button still clears the 3:1 a focus
 * indicator needs.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-tertiary border border-primary hover:bg-primary-60 hover:border-primary-60 active:bg-primary-70 disabled:bg-primary/45 disabled:border-transparent",
  secondary:
    "bg-surface text-primary-ink border border-primary/35 hover:bg-pale hover:border-primary/60 active:bg-primary-70/25 disabled:text-primary-ink/45 disabled:hover:bg-surface",
  ghost:
    "bg-transparent text-tertiary border border-transparent hover:bg-surface-muted active:bg-surface-muted disabled:text-muted-text",
  danger:
    "bg-surface text-error-ink border border-error/40 hover:bg-error-surface active:bg-error/15 disabled:text-error-ink/45 disabled:hover:bg-surface",
};

const SIZES: Record<Size, string> = {
  sm: "h-[38px] px-3.5 text-label-md",
  md: "h-[47px] px-[25px] text-button-text",
  lg: "h-[52px] px-7 text-button-text",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", fullWidth, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-semibold",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
          "disabled:cursor-not-allowed",
          VARIANTS[variant],
          SIZES[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      />
    );
  },
);

/**
 * A button that opens a new tab. `noopener`/`noreferrer` are set
 * unconditionally so the opened page cannot reach back into this one.
 */
export function ExternalLinkButton({
  href,
  children,
  className,
  variant = "secondary",
  size = "sm",
  ...props
}: Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "type" | "className"
> & {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
