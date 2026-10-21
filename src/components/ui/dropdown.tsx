"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * An accessible dropdown built on native buttons.
 *
 * It closes on Escape, on outside click, and when focus leaves the popover,
 * and it wires `aria-expanded` / `aria-controls` so the state is announced.
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  label,
  className,
  buttonClassName,
}: {
  /**
   * Custom trigger. When omitted a default button is rendered, which is what
   * most call sites want.
   */
  trigger?: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  label: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  // Restore focus to the trigger when the popover closes. This lives in an
  // effect rather than in `close` so that a ref is never read during render.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {trigger ? (
        trigger({ open, toggle: () => setOpen((value) => !value), id })
      ) : (
        <button
          ref={triggerRef}
          type="button"
          id={id}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-panel` : undefined}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3",
            "text-label-md font-semibold text-secondary transition-colors hover:bg-surface-muted",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            buttonClassName,
          )}
        >
          <span className="sr-only">{label}</span>
          {label}
          <ChevronDown aria-hidden="true" className="size-4 text-muted-text" />
        </button>
      )}
      {open ? (
        <div
          id={`${id}-panel`}
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-2 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A single item inside a dropdown.
 */
export function DropdownItem({
  onSelect,
  children,
  href,
  destructive,
}: {
  onSelect?: () => void;
  children: ReactNode;
  href?: string;
  destructive?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-body-sm",
    "transition-colors hover:bg-surface-muted",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    destructive ? "text-error hover:bg-error-surface" : "text-secondary",
  );

  if (href) {
    return (
      <a
        href={href}
        role="menuitem"
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role="menuitem"
      className={className}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
