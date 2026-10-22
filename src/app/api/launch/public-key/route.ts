import { NextResponse } from "next/server";
import { getLaunchPublicJwk } from "@/lib/launch/service";

export const dynamic = "force-dynamic";

/**
 * CORS for the verification key.
 *
 * The verification key is public by definition: it exists so that something
 * other than CCM can check that a launch ticket was really issued by this
 * deployment. The browser bridge extension fetches it from an
 * extension origin, which the browser treats as cross-origin, so the
 * response has to say that is allowed. The local helper makes the same kind
 * of request from a localhost origin. Both may read a public key; that is the
 * same precondition every verifier needs in order to refuse a forged ticket.
 *
 * The key is not the secret. The secret is the private half, which never
 * leaves the server.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  try {
    const jwk = await getLaunchPublicJwk();

    if (!jwk) {
      return NextResponse.json(
        {
          error:
            "The launch signing key is not configured. Set LAUNCH_SIGNING_PUBLIC_KEY.",
        },
        { status: 503, headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(jwk, {
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    // A malformed or truncated key is a configuration problem, not a server
    // error. Say exactly what is wrong so it can be fixed in one step.
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `The launch signing key could not be imported: ${error.message}. It may be truncated - a P-256 public key PEM carries 124 base64 characters. Regenerate it with: npm run keys:launch`
            : "The launch signing key could not be imported.",
        code: "invalid_signing_key",
      },
      { status: 503, headers: CORS_HEADERS },
    );
  }
}