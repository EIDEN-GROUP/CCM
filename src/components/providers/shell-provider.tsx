"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveRangeFromParams } from "@/lib/range-params";
import type { DateRange, RangePreset } from "@/domain/dates";

interface ShellContextValue {
  /** The active range, driven by the URL. */
  range: DateRange;
  /** Move to a preset range. Updates the URL so the server re-queries. */
  setPreset: (preset: Exclude<RangePreset, "custom">) => void;
  /** Move to an explicit range. */
  setCustomRange: (start: string, end: string) => void;
  /** Today's date in the workspace timezone, supplied by the server. */
  today: string;
  /** Workspace display timezone. */
  timezone: string;
  /**
   * Whether the off-canvas navigation drawer is open.
   *
   * The drawer only exists below the `md` breakpoint; on a wide screen the
   * navigation rail is always on screen and this flag stays false.
   */
  navOpen: boolean;
  /** Reveal the navigation drawer (phone layout). */
  openNav: () => void;
  /** Hide the navigation drawer (phone layout). */
  closeNav: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

const RANGE_PARAM = "range";
const FROM_PARAM = "from";
const TO_PARAM = "to";

export function ShellProvider({
  today,
  timezone,
  children,
}: {
  today: string;
  timezone: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navOpen, setNavOpen] = useState(false);

  const openNav = useCallback(() => setNavOpen(true), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  const setPreset = useCallback(
    (preset: Exclude<RangePreset, "custom">) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(RANGE_PARAM, preset);
      params.delete(FROM_PARAM);
      params.delete(TO_PARAM);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const setCustomRange = useCallback(
    (start: string, end: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(RANGE_PARAM);
      params.set(FROM_PARAM, start);
      params.set(TO_PARAM, end);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // The range is derived from the URL, so the shell and the server-rendered
  // page always agree on the window being reported on.
  const range = useMemo(() => {
    const params: Record<string, string | string[] | undefined> = {};
    for (const key of [RANGE_PARAM, FROM_PARAM, TO_PARAM]) {
      const value = searchParams.get(key);
      if (value !== null) params[key] = value;
    }
    return resolveRangeFromParams(params, today).range;
  }, [searchParams, today]);

  const value = useMemo<ShellContextValue>(
    () => ({
      range,
      setPreset,
      setCustomRange,
      today,
      timezone,
      navOpen,
      openNav,
      closeNav,
    }),
    [
      range,
      setPreset,
      setCustomRange,
      today,
      timezone,
      navOpen,
      openNav,
      closeNav,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used inside <ShellProvider>");
  }
  return context;
}
