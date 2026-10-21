import type { JobHandler } from "@/lib/jobs/runner";

/**
 * The technical crawl.
 *
 * It records the URL, the locale, the page class and the metadata of each
 * page — never a copy of the page. The pages table holds a title, a
 * canonical URL, a status code and a count of headings; it does not hold the
 * body, so a crawl of a site cannot become a copy of that site.
 *
 * The crawl is polite: it reads `robots.txt` first, follows the sitemap
 * when there is one, and makes a bounded number of requests with a delay
 * between them.
 */

const USER_AGENT = "CCM-Crawler/1.0 (+https://medicalbay.ma; technical audit)";
const MAX_PAGES = 200;
const REQUEST_DELAY_MS = 400;
const REQUEST_TIMEOUT_MS = 20_000;

/** The service lines Medical Bay groups its pages under. */
const SERVICE_LINES = [
  "dentistry",
  "hair_transplant",
  "medical_tourism",
  "general_surgery",
  "aesthetics",
] as const;

/** A page, as the crawl reads it. */
interface CrawledPage {
  url: string;
  path: string;
  locale: string | null;
  pageClass: string;
  serviceLine: string | null;
  title: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  statusCode: number | null;
  metaDescription: string | null;
  h1Count: number | null;
}

export const siteCrawlHandler: JobHandler = async (context) => {
  const websiteId =
    (context.job.payload as { websiteId?: string }).websiteId ??
    context.account.id;

  const { data: website } = await context.db
    .from("websites")
    .select("id, name, domain, locales, service_lines")
    .eq("id", websiteId)
    .maybeSingle();

  if (!website) {
    throw new Error("The website this crawl is for no longer exists.");
  }

  const site = website as {
    id: string;
    name: string;
    domain: string;
    locales: string[] | null;
    service_lines: string[] | null;
  };

  const origin = `https://${site.domain}`;
  const locales = site.locales ?? ["fr", "en", "ar"];

  const robots = await readRobots(origin);
  const sitemapUrls = await readSitemap(origin);

  // The sitemap is the best source. When there is none, the site's own
  // home page links are the fallback.
  const candidates = sitemapUrls.length > 0 ? sitemapUrls : await seedUrls(origin);

  const disallowed = (url: string) =>
    robots.disallowed.some((rule) => sameHost(rule, url));

  // A **host** comparison, not a string prefix. `https://medicalbay.ma.evil.tld`
  // and `https://medicalbay.ma@evil.tld` both start with the site's origin
  // but belong to somebody else, and the crawl fetches them with the server's
  // own identity.
  const toCrawl = candidates
    .filter((url) => sameHost(url, origin))
    .filter((url) => !disallowed(url))
    .slice(0, MAX_PAGES);

  const pages: CrawledPage[] = [];

  for (const url of toCrawl) {
    const page = await crawlPage(url, origin, locales);
    if (page) pages.push(page);
    await sleep(REQUEST_DELAY_MS);
  }

  if (pages.length === 0) {
    throw new Error(
      `The crawl of ${origin} found no pages. Check that the domain is correct and that it answers over HTTPS.`,
    );
  }

  const now = new Date().toISOString();

  const rows = pages.map((page) => ({
    workspace_id: context.job.workspace_id,
    website_id: site.id,
    url: page.url,
    path: page.path,
    locale: page.locale,
    page_class: page.pageClass,
    service_line: page.serviceLine,
    title: page.title,
    canonical_url: page.canonicalUrl,
    noindex: page.noindex,
    status_code: page.statusCode,
    meta_description: page.metaDescription,
    h1_count: page.h1Count,
    last_crawled_at: now,
    updated_at: now,
  }));

  const { error } = await context.db
    .from("website_pages")
    .upsert(rows, { onConflict: "website_id,url" });

  if (error) {
    throw new Error(`Could not write the crawled pages: ${error.message}`);
  }

  return {
    rowsWritten: rows.length,
    notes: [
      `Crawled ${rows.length} page(s) from ${origin}.`,
      "Only the URL, the locale, the page class and the metadata are stored — never a copy of the page.",
      robots.disallowed.length > 0
        ? `${robots.disallowed.length} path(s) were excluded by robots.txt.`
        : "robots.txt was not found, so no path was excluded.",
    ],
  };
};

/** A pause between requests, so the crawl does not hammer the site. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Whether two URLs belong to the same origin.
 *
 * A string prefix is not enough: `https://medicalbay.ma.evil.tld` and
 * `https://medicalbay.ma@evil.tld` both begin with the site's origin, and
 * the second parses to the host `evil.tld`.
 *
 * The scheme is compared too, so a page that links the `http://` version of
 * the site is not silently crawled over an unencrypted connection.
 */
export function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Read `robots.txt` and collect the disallowed prefixes. */
async function readRobots(origin: string): Promise<{ disallowed: string[] }> {
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return { disallowed: [] };

    const text = await response.text();
    const disallowed: string[] = [];

    // Only the paths that apply to every crawler are honoured.
    let inUserAgentBlock = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const [rawKey, ...rest] = line.split(":");
      const key = rawKey!.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        inUserAgentBlock = value === "*";
        continue;
      }
      if (key === "disallow" && inUserAgentBlock && value) {
        disallowed.push(new URL(value, origin).toString());
      }
    }

    return { disallowed };
  } catch {
    return { disallowed: [] };
  }
}

/** Read the sitemap and collect the URLs. */
async function readSitemap(origin: string): Promise<string[]> {
  const urls: string[] = [];

  // The usual locations, in the order a site is likely to use them.
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) continue;

      const text = await response.text();
      const found = [...text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(
        (match) => match[1]!.trim(),
      );

      if (found.length === 0) continue;

      // A sitemap index points at more sitemaps.
      if (/<sitemapindex/i.test(text)) {
        for (const nested of found.slice(0, 10)) {
          urls.push(...(await readSitemap(nested)));
        }
        continue;
      }

      urls.push(...found);
      break;
    } catch {
      // A missing sitemap is not a failure; the fallback is used instead.
    }
  }

  return [...new Set(urls)];
}

/**
 * The fallback: the home page and the links it carries.
 *
 * It is a first page, not a crawl of the whole site — the sitemap is the
 * right source and this is only for a site that has none.
 */
async function seedUrls(origin: string): Promise<string[]> {
  try {
    const response = await fetch(origin, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return [origin];

    const html = await response.text();
    const links = [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)]
      .map((match) => match[1]!.trim())
      .filter((href) => href.startsWith("/") || href.startsWith(origin));

    const resolved = [...new Set(links)].map((href) =>
      href.startsWith("/") ? `${origin}${href}` : href,
    );

    return [origin, ...resolved].slice(0, 30);
  } catch {
    return [origin];
  }
}

/** Fetch one page and read what CCM records. */
async function crawlPage(
  url: string,
  origin: string,
  locales: string[],
): Promise<CrawledPage | null> {
  let statusCode: number | null = null;
  let html = "";

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    statusCode = response.status;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return {
        url,
        path: pathOf(url, origin),
        locale: localeOf(url, locales),
        pageClass: "other",
        serviceLine: null,
        title: null,
        canonicalUrl: null,
        noindex: false,
        statusCode,
        metaDescription: null,
        h1Count: null,
      };
    }

    html = await response.text();
  } catch {
    // A page that does not answer is recorded with its absence, not hidden.
    return {
      url,
      path: pathOf(url, origin),
      locale: localeOf(url, locales),
      pageClass: "other",
      serviceLine: null,
      title: null,
      canonicalUrl: null,
      noindex: false,
      statusCode: null,
      metaDescription: null,
      h1Count: null,
    };
  }

  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonical = firstMatch(
    html,
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
  );
  const metaDescription = firstMatch(
    html,
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
  );

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;

  const noindex = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(
    html,
  );

  const path = pathOf(url, origin);

  return {
    url,
    path,
    locale: localeOf(url, locales),
    pageClass: classify(path, title),
    serviceLine: serviceLineOf(path),
    title: title ? decodeEntities(title).slice(0, 300) : null,
    canonicalUrl: canonical ?? null,
    noindex,
    statusCode,
    metaDescription: metaDescription ? decodeEntities(metaDescription).slice(0, 500) : null,
    h1Count,
  };
}

/** The first capture of a pattern, cleaned of whitespace. */
function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  if (!match || !match[1]) return null;
  const value = match[1].replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : null;
}

/** The path of a URL, relative to the site root. */
function pathOf(url: string, origin: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    return path === "" ? "/" : path;
  } catch {
    return url.startsWith(origin) ? url.slice(origin.length) || "/" : url;
  }
}

/**
 * The locale, when the path names one.
 *
 * The site's own locales are used, so a path that happens to contain a
 * two-letter segment is not mistaken for a locale.
 */
function localeOf(url: string, locales: string[]): string | null {
  const path = pathOf(url, "");
  const segment = path.split("/").filter(Boolean)[0]?.toLowerCase();

  if (!segment) return null;
  if (!locales.some((locale) => locale.toLowerCase() === segment)) return null;

  return segment;
}

/**
 * The page class, from the path and the title.
 *
 * The order matters: a legal page is a legal page whatever else it says,
 * and a service page is a service page even if it reads like an article.
 */
export function classify(path: string, title: string | null): string {
  const lower = path.toLowerCase();
  const text = (title ?? "").toLowerCase();

  if (
    /(^|\/)(legal|privacy|mentions-legales|mentions-legales\/|privacy-policy|cookie|cookies|terms|conditions|imprint|legal-notice|disclaimer)/.test(
      lower,
    )
  ) {
    return "legal";
  }

  if (/\/(blog|actualites|news|journal|magazine|articles?)\//.test(lower)) {
    return "content";
  }

  if (
    /\/(services?|prestations?|soins?|traitements?|dentistry|dentiste|dentistes|greffe|cheveux|hair|transplant|chirurgie|aesthetic|estheticque)/.test(
      lower,
    )
  ) {
    return "service";
  }

  if (
    /contact|reservation|reserver|devis|rendez-vous/.test(lower) ||
    /contact|appointment|book|book now/.test(text)
  ) {
    return "landing";
  }

  if (path === "/" || lower === "") return "landing";

  return "other";
}

/** The service line, when the path names one. */
export function serviceLineOf(path: string): string | null {
  const lower = path.toLowerCase();

  // The more specific pattern is checked first: "chirurgie-esthetique" is
  // aesthetics, not general surgery.
  if (lower.includes("esthet") || lower.includes("beaut")) {
    return "aesthetics";
  }
  if (lower.includes("/dent") || lower.includes("implant")) {
    return "dentistry";
  }
  if (
    lower.includes("/cheveu") ||
    lower.includes("/greffe") ||
    lower.includes("/hair") ||
    lower.includes("transplant")
  ) {
    return "hair_transplant";
  }
  if (lower.includes("chirurgie")) return "general_surgery";
  if (lower.includes("tourisme") || lower.includes("/medical")) {
    return "medical_tourism";
  }

  // The service line names the site uses.
  for (const line of SERVICE_LINES) {
    if (lower.includes(line.replace(/_/g, "-")) || lower.includes(line)) {
      return line;
    }
  }

  return null;
}

/** The handful of entities that appear in a title or a description. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
