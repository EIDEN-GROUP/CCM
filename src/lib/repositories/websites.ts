import type { Db } from "@/lib/repositories/types";

export interface WebsiteRow {
  id: string;
  workspace_id: string;
  name: string;
  domain: string;
  primary_locale: string;
  locales: string[];
  service_lines: string[];
  owner_label: string | null;
  health_state: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsitePageRow {
  id: string;
  website_id: string;
  url: string;
  path: string;
  locale: string | null;
  page_class: string;
  service_line: string | null;
  title: string | null;
  canonical_url: string | null;
  noindex: boolean;
  status_code: number | null;
  meta_description: string | null;
  h1_count: number | null;
  last_crawled_at: string | null;
}

/**
 * The website registry.
 *
 * Adding a future Medical Bay microsite is a row insert, not a schema
 * change — which is why the registry is generic rather than hard-coded to
 * one domain.
 */
export async function listWebsites(
  db: Db,
  workspaceId: string,
): Promise<WebsiteRow[]> {
  const { data, error } = await db
    .from("websites")
    .select(
      "id, workspace_id, name, domain, primary_locale, locales, service_lines, owner_label, health_state, is_active, notes, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not list websites: ${error.message}`);
  return (data ?? []) as WebsiteRow[];
}


/**
 * The hostnames that answer for a website.
 *
 * A site usually answers on more than one hostname — the bare domain and
 * the `www` form — and the launcher and the health checks both need to
 * know which are in play.
 */
export async function listWebsiteDomains(
  db: Db,
  workspaceId: string,
): Promise<Array<{ website_id: string; hostname: string; is_primary: boolean }>> {
  // The hostname table is keyed by website, not by workspace, so the
  // workspace filter comes through the parent.
  const { data: sites, error: siteError } = await db
    .from("websites")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (siteError) return [];

  const websiteIds = (sites ?? []).map(
    (site) => (site as { id: string }).id,
  );
  if (websiteIds.length === 0) return [];

  const { data, error } = await db
    .from("website_domains")
    .select("website_id, hostname, is_primary")
    .in("website_id", websiteIds)
    .order("is_primary", { ascending: false })
    .order("hostname", { ascending: true });

  if (error) {
    // The hostnames are supplementary; a failure here must not break the
    // page.
    return [];
  }

  return (data ?? []) as Array<{
    website_id: string;
    hostname: string;
    is_primary: boolean;
  }>;
}export async function listWebsitePages(
  db: Db,
  workspaceId: string,
  options: { websiteId?: string; limit?: number } = {},
): Promise<WebsitePageRow[]> {
  let query = db
    .from("website_pages")
    .select(
      "id, website_id, url, path, locale, page_class, service_line, title, canonical_url, noindex, status_code, meta_description, h1_count, last_crawled_at",
    )
    .eq("workspace_id", workspaceId)
    .order("url", { ascending: true })
    .limit(options.limit ?? 500);

  if (options.websiteId) {
    query = query.eq("website_id", options.websiteId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not list website pages: ${error.message}`);
  return (data ?? []) as WebsitePageRow[];
}

/** The most recent health check per website and check type. */
export async function latestHealthChecks(
  db: Db,
  workspaceId: string,
): Promise<
  Array<{
    id: string;
    website_id: string;
    check_type: string;
    status: string;
    checked_at: string;
    value: number | null;
    unit: string | null;
    detail: Record<string, unknown>;
  }>
> {
  const { data, error } = await db
    .from("site_health_checks")
    .select("id, website_id, check_type, status, checked_at, value, unit, detail")
    .eq("workspace_id", workspaceId)
    .order("checked_at", { ascending: false })
    .limit(500);

  if (error) {
    // Health checks are supplementary; a failure here must not break the page.
    return [];
  }
  return (data ?? []) as Array<{
    id: string;
    website_id: string;
    check_type: string;
    status: string;
    checked_at: string;
    value: number | null;
    unit: string | null;
    detail: Record<string, unknown>;
  }>;
}
