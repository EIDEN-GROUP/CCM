import { NextResponse } from "next/server";
import { getLaunchPublicJwk } from "@/lib/launch/service";

export const dynamic = "force-dynamic";

/**
 * The launch ticket verification key.
 *
 * This is a *public* key. Publishing it is what lets the browser bridge
 * extension verify that a launch ticket really came from this CCM
 * deployment, without the extension ever holding a signing secret.
 *
 * The endpoint is unauthenticated on purpose — the extension cannot hold a
 * session cookie for the web app — but a public key is not sensitive. The
 * security comes from the extension pinning the expected origin and the key
 * id, not from hiding this document.
 */
export async function GET() {
  try {
    const jwk = await getLaunchPublicJwk();

    if (!jwk) {
      return NextResponse.json(
        {
          error:
            "The launch signing key is not configured. Set LAUNCH_SIGNING_PUBLIC_KEY.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(jwk, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    // A malformed or truncated key is a configuration problem, not a server
    // error. Say exactly what is wrong so it can be fixed in one step.
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `The launch signing key could not be imported: ${error.message}. It may be truncated — a P-256 public key PEM carries 124 base64 characters. Regenerate it with: npm run keys:launch`
            : "The launch signing key could not be imported.",
        code: "invalid_signing_key",
      },
      { status: 503 },
    );
  }
}
