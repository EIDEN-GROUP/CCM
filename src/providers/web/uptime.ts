import { connect, type TLSSocket } from "node:tls";
import {
  ConnectorError,
  type ConnectorAccount,
  type ConnectorAuth,
  type DailyFact,
  type ProviderConnector,
  type ReportRequest,
  type ReportResult,
} from "../connector";

/**
 * Uptime and TLS checks.
 *
 * There is no third-party uptime API here, and that is deliberate: CCM
 * checks the sites it already knows about, from the server, and records the
 * result. Nothing about the request identifies a visitor.
 *
 * Two checks:
 *   - **uptime** — an HTTP request to the hostname, with the status and the
 *     time it took.
 *   - **TLS** — the certificate's expiry, read from the handshake.
 *
 * The check is read-only and sent to the site's own host. It is never sent
 * with a cookie, a session or a referrer.
 */

const USER_AGENT =
  "CCM-HealthCheck/1.0 (+https://medicalbay.ma; uptime and certificate check)";

interface TlsInfo {
  valid: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  protocol?: string;
  error?: string;
}

/** The result of an HTTP reachability probe. */
interface HttpProbeResult {
  status: number;
  durationMs: number;
  error?: string;
}

export class UptimeConnector implements ProviderConnector {
  readonly key = "uptime" as const;
  readonly apiVersion = "n/a";

  constructor(
    private readonly options: {
      timeoutMs?: number;
      /** Injected in tests so the socket is not opened for real. */
      tlsProbe?: (hostname: string) => Promise<TlsInfo>;
      httpProbe?: (url: string) => Promise<HttpProbeResult>;
    } = {},
  ) {}

  async listAccounts(auth: ConnectorAuth): Promise<ConnectorAccount[]> {
    void auth;
    // The targets come from the website registry, not from an account list.
    return [];
  }

  async readReport(
    account: ConnectorAccount,
    request: ReportRequest,
    auth: ConnectorAuth,
  ): Promise<ReportResult> {
    void auth;

    const url =
      (account.identifiers.uptime as { url?: string } | undefined)?.url ??
      account.externalAccountId;

    if (!url) {
      throw ConnectorError.invalidResponse(
        "The uptime target has no URL, so nothing can be checked.",
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      throw ConnectorError.invalidResponse(
        "The uptime target is not a valid URL.",
      );
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw ConnectorError.invalidResponse(
        "Only http and https targets can be checked.",
      );
    }

    const timeoutMs = this.options.timeoutMs ?? 15_000;

    const [http, tls] = await Promise.all([
      (this.options.httpProbe ??
        ((url: string) => defaultHttpProbe(url, timeoutMs)))(parsed.toString()).catch(
        (error): HttpProbeResult => ({
          status: 0,
          durationMs: 0,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
      (this.options.tlsProbe ??
        ((hostname: string) => defaultTlsProbe(hostname, timeoutMs)))(parsed.hostname).catch(
        (error): TlsInfo => ({
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      ),
    ]);

    const reachable = http.status > 0 && http.status < 500;

    const facts: DailyFact[] = [
      {
        metricDate: request.endDate,
        dimension: "uptime",
        dimensionId: parsed.hostname,
        dimensionLabel: parsed.hostname,
        values: {
          url: parsed.toString(),
          hostname: parsed.hostname,
          // A failed check is not a 0. The status is the real one, or null.
          status_code: http.status > 0 ? http.status : null,
          response_ms: http.durationMs > 0 ? http.durationMs : null,
          reachable,
          error: http.error ?? null,
          tls_valid: tls.valid,
          tls_issuer: tls.issuer ?? null,
          tls_subject: tls.subject ?? null,
          tls_valid_from: tls.validFrom ?? null,
          tls_valid_to: tls.validTo ?? null,
          tls_days_remaining: tls.daysRemaining ?? null,
          tls_protocol: tls.protocol ?? null,
          tls_error: tls.error ?? null,
        },
        sourceFetchedAt: new Date().toISOString(),
      },
    ];

    const notes = [
      "The check is made from CCM's server with no cookie and no session. It is not a real-user measurement.",
    ];

    if (!tls.valid) {
      notes.push(
        "The TLS certificate could not be read. That is reported as unknown, not as a valid certificate.",
      );
    }

    if (!reachable) {
      notes.push(
        "The site did not answer. The status code is unavailable rather than zero.",
      );
    }

    return { facts, truncated: false, notes };
  }
}

/** The default HTTP probe. */
async function defaultHttpProbe(
  url: string,
  timeoutMs = 15_000,
): Promise<HttpProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const startedAt = Date.now();
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    });
    return { status: response.status, durationMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

/** The default TLS probe. */
function defaultTlsProbe(
  hostname: string,
  timeoutMs = 15_000,
): Promise<TlsInfo> {
  return new Promise<TlsInfo>((resolve) => {
    let socket: TLSSocket | null = null;

    const done = (info: TlsInfo) => {
      try {
        socket?.destroy();
      } catch {
        // The socket is already gone.
      }
      resolve(info);
    };

    try {
      socket = connect({ host: hostname, port: 443, servername: hostname }, () => {
        const peer = socket!.getPeerCertificate(false);
        const validTo = peer?.valid_to ? new Date(peer.valid_to) : null;
        const validFrom = peer?.valid_from ? new Date(peer.valid_from) : null;

        done({
          valid: Boolean(peer && Object.keys(peer).length > 0),
          issuer:
            typeof peer?.issuer?.O === "string"
              ? (peer.issuer.O as string)
              : undefined,
          subject:
            typeof peer?.subject?.CN === "string"
              ? (peer.subject.CN as string)
              : undefined,
          validFrom: validFrom ? validFrom.toISOString() : undefined,
          validTo: validTo ? validTo.toISOString() : undefined,
          daysRemaining: validTo
            ? Math.floor((validTo.getTime() - Date.now()) / 86_400_000)
            : undefined,
          protocol: socket!.getProtocol() ?? undefined,
        });
      });

      socket.setTimeout(timeoutMs, () => {
        done({ valid: false, error: "The TLS handshake timed out." });
      });

      socket.on("error", (error) => {
        done({ valid: false, error: error.message });
      });
    } catch (error) {
      done({
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export const uptimeConnector = new UptimeConnector();
