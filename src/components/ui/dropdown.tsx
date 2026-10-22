"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The role of the panel a dropdown item sits in, and the way to close it.
 *
 * Items are menu items only when the panel is a menu; inside a panel that
 * holds form controls they are ordinary buttons. The close function lets an
 * item dismiss the panel it lives in, which matters for a route: the
 * client-side navigation would otherwise leave the panel open behind it.
 */
const PanelContext = createContext<{
  role: "menu" | "group" | "dialog";
  close: () => void;
}>({ role: "menu", close: () => {} });

/**
 * Whether a destination leaves this application.
 *
 * A scheme or a protocol-relative address leaves it; a path does not.
 */
function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

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
  panelRole = "menu",
}: {
  /**
   * Custom trigger. When omitted a default button is rendered, which is what
   * most call sites want.
   */
  trigger?: (props: {
    open: boolean;
    toggle: () => void;
    /** Id of the trigger button. */
    id: string;
    /** Id of the popover, for `aria-controls`. */
    panelId: string;
    /**
     * Attach to the trigger button with `ref={triggerRef}` so the focus can
     * return to it when the popover closes.
     *
     * It is a callback ref rather than a ref object because the trigger is
     * rendered by a caller: a ref object handed to a render prop could be
     * read during render, which React does not allow.
     */
    triggerRef: (node: HTMLButtonElement | null) => void;
  }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  label: string;
  className?: string;
  buttonClassName?: string;
  /**
   * The role of the popover.
   *
   * `menu` for a list of commands. `group` when the popover holds form
   * controls — `role="menu"` is invalid for inputs, because a menu only
   * accepts menu items.
   */
  panelRole?: "menu" | "group" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const panelId = `${id}-panel`;

  // The trigger button belongs to the caller. It is held in state rather
  // than in a ref because the trigger is rendered through a render prop: a
  // ref object handed to a render prop could be read during render, which
  // React does not allow.
  const [triggerNode, setTriggerNode] = useState<HTMLButtonElement | null>(
    null,
  );
  const attachTrigger = useCallback((node: HTMLButtonElement | null) => {
    setTriggerNode(node);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const panel = useMemo(
    () => ({ role: panelRole, close }),
    [panelRole, close],
  );

  // Restore focus to the trigger when the popover closes. This lives in an
  // effect rather than in `close` so that a ref is never read during render.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerNode?.focus();
    }
    wasOpen.current = open;
  }, [open, triggerNode]);

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
        trigger({
          open,
          toggle: () => setOpen((value) => !value),
          id,
          panelId,
          triggerRef: attachTrigger,
        })
      ) : (
        <button
          ref={attachTrigger}
          type="button"
          id={id}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-surface px-3",
            "text-label-md font-semibold text-secondary transition-colors hover:bg-surface-muted",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
            buttonClassName,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-text" />
        </button>
      )}
      {open ? (
        <PanelContext.Provider value={panel}>
          <div
            id={panelId}
            role={panelRole}
            aria-label={label}
            className={cn(
              "absolute z-50 mt-2 min-w-[220px] rounded-lg border border-border bg-surface p-1.5 shadow-overlay",
              align === "end" ? "end-0" : "start-0",
            )}
          >
            {children({ close })}
          </div>
        </PanelContext.Provider>
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
  const { role: panelRole, close } = useContext(PanelContext);
  // `menuitem` is only correct inside a menu. In a panel that holds form
  // controls the items are ordinary buttons.
  const role = panelRole === "menu" ? "menuitem" : undefined;

  const className = cn(
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-start text-body-sm",
    "transition-colors hover:bg-surface-muted",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink",
    destructive ? "text-error-ink hover:bg-error-surface" : "text-secondary",
  );

  if (href) {
    // A route in this application opens in this tab, the way every other
    // link in CCM does.
    if (!isExternal(href) && href.startsWith("/")) {
      return (
        <Link
          href={href}
          role={role}
          className={className}
          onClick={() => {
            onSelect?.();
            close();
          }}
        >
          {children}
        </Link>
      );
    }

    // A destination that leaves the application opens in a new tab, and
    // says so, so nobody follows it expecting to come back.
    if (isExternal(href)) {
      return (
        <a
          href={href}
          role={role}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          {children}
          <ExternalLink
            aria-hidden="true"
            className="ms-auto size-3.5 shrink-0 text-muted-text"
          />
        </a>
      );
    }

    return (
      <a href={href} role={role} className={className} onClick={close}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      role={role}
      className={className}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
