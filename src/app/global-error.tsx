"use client";

/**
 * The last-resort boundary.
 *
 * This replaces the root layout itself, so it cannot use the application's
 * providers, fonts or messages — it has to stand alone. It renders the
 * reference and nothing else: an error message can carry a provider
 * response, a query or a fragment of somebody's data, and it is never put
 * on the screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f8f9",
          color: "#3a3a3a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: "32rem", padding: "2.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>
            CCM could not start
          </h1>
          <p style={{ margin: "0 0 1rem", color: "#4b4f58", lineHeight: 1.6 }}>
            The application failed before it could render. The failure has been
            recorded. Quote the reference below when you report it.
          </p>
          <p
            style={{
              margin: "0 0 1.5rem",
              padding: "0.5rem 0.75rem",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.85rem",
            }}
          >
            Reference: {error.digest ?? "unknown"}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: "7px",
              background: "#4bbdbd",
              color: "#ffffff",
              padding: "0.7rem 1.4rem",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
