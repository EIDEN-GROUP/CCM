import { redirect } from "next/navigation";

/**
 * The root.
 *
 * The command centre's home is the overview, so the root is a redirect
 * rather than a page of its own.
 *
 * It has to exist. The proxy sends an unauthenticated visitor from any
 * protected path to `/login?next=<that path>`, so a visit to `/` arrives
 * back at `/` after sign-in. Without this page that is a 404.
 */
export default function RootPage() {
  redirect("/overview");
}
