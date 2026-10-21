import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * The 404 page.
 *
 * A person who reaches a page that does not exist gets the same design
 * language as the rest of the product and a way out, rather than a
 * framework's default page.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-muted/50 px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary text-tertiary"
        >
          <span className="text-label-md font-bold">CCM</span>
        </span>

        <div className="space-y-2">
          <p className="text-label-md font-semibold uppercase tracking-[0.08em] text-primary-ink">
            404
          </p>
          <h1 className="text-headline-lg font-bold text-tertiary">
            That page does not exist
          </h1>
          <p className="text-body-md text-muted-text">
            The address may be mistyped, or the screen may have been renamed.
            Nothing has gone wrong with your data.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/overview"
            className="inline-flex h-[47px] items-center justify-center gap-2 rounded-md border border-primary bg-primary px-[25px] text-button-text font-semibold text-tertiary transition-colors hover:bg-primary-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            <Compass aria-hidden="true" className="size-4" />
            Go to the overview
          </Link>
          <Link
            href="/search"
            className="inline-flex h-[47px] items-center justify-center rounded-md border border-primary/35 bg-surface px-[25px] text-button-text font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            Search
          </Link>
        </div>
      </div>
    </main>
  );
}
