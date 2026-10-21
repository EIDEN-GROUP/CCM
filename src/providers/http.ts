import { ConnectorError } from "./connector";

/**
 * A thin HTTP helper shared by the provider connectors.
 *
 * It turns transport and provider-level failures into `ConnectorError`s with
 * a retryable flag, so the sync worker can decide between "try again with
 * backoff" and "this needs a human" without knowing the provider.
 */

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
  body?: unknown;
  /** Extra headers. The access token is added automatically. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Provider-specific base URL. */
  baseUrl?: string;
  /** Path relative to the base URL. */
  path: string;
  /** Human name of the provider, used in error messages. */
  provider: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function providerRequest<T>(
  accessToken: string,
  options: RequestOptions,
): Promise<T> {
  const url = `${options.baseUrl ?? ""}${options.path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  // Chain the caller's signal so a cancelled job stops the request too.
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      throw new ConnectorError("The request was cancelled", "cancelled", false);
    }
    options.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConnectorError("The request timed out", "timeout", true);
    }
    throw ConnectorError.unavailable(
      `${options.provider} could not be reached: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  const body = await response.text().catch(() => "");
  const detail = extractProviderMessage(body);

  if (response.status === 401) {
    throw ConnectorError.auth(
      `${options.provider} rejected the token${detail ? `: ${detail}` : ""}.`,
    );
  }
  if (response.status === 403) {
    throw ConnectorError.permission(
      `${options.provider} denied the request${detail ? `: ${detail}` : ""}.`,
    );
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") ?? "");
    throw ConnectorError.rateLimited(
      `${options.provider} rate limit reached${detail ? `: ${detail}` : ""}.`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
  if (response.status >= 500) {
    throw ConnectorError.unavailable(
      `${options.provider} returned ${response.status}${detail ? `: ${detail}` : ""}.`,
    );
  }

  throw new ConnectorError(
    `${options.provider} returned ${response.status}${detail ? `: ${detail}` : ""}.`,
    "request_failed",
    false,
    response.status,
  );
}

/**
 * Pull a human message out of a Google-style error body.
 */
function extractProviderMessage(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Fall through to the raw body.
  }
  return body.slice(0, 300) || null;
}
