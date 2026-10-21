import { LoadingState } from "@/components/ui/states";

/**
 * The loading state for the application group.
 *
 * Every screen in the command centre reads from the database, so every
 * screen has a moment of waiting. This is what that moment looks like,
 * rather than a blank page.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-md bg-surface-muted/60" />
      <LoadingState rows={4} />
    </div>
  );
}
