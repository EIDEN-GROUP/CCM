/**
 * Minimal JWS (ES256) verification using the Web Crypto API only.
 *
 * The extension deliberately has no dependencies. It must be small, auditable
 * and free of any code that could be influenced by a third party.
 */

/** Decode a base64url segment into bytes. */
export function base64UrlDecode(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Decode a base64url segment into a UTF-8 string. */
export function base64UrlDecodeText(segment) {
  return new TextDecoder("utf-8").decode(base64UrlDecode(segment));
}

export class JwsError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "JwsError";
    this.code = code;
  }
}

/**
 * Verify an ES256 JWS and return its claims.
 *
 * @param {string} token
 * @param {CryptoKey} publicKey an ECDSA P-256 public key.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function verifyEs256(token, publicKey) {
  if (typeof token !== "string" || token.length === 0) {
    throw new JwsError("The launch ticket is empty", "invalid_format");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwsError("The launch ticket is not a three-part JWS", "invalid_format");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;

  let header;
  try {
    header = JSON.parse(base64UrlDecodeText(headerSegment));
  } catch {
    throw new JwsError("The launch ticket header is not valid JSON", "invalid_format");
  }

  if (header.alg !== "ES256") {
    // Refusing any other algorithm is what prevents an "alg: none" or an
    // algorithm-confusion attack.
    throw new JwsError(
      `Unsupported signature algorithm: ${String(header.alg)}`,
      "unsupported_algorithm",
    );
  }
  if (header.typ && header.typ !== "JWT") {
    throw new JwsError(`Unexpected token type: ${String(header.typ)}`, "invalid_format");
  }

  const signature = base64UrlDecode(signatureSegment);
  if (signature.length !== 64) {
    throw new JwsError(
      "The launch ticket signature has the wrong length for ES256",
      "invalid_signature",
    );
  }

  const signedBytes = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    signature,
    signedBytes,
  );

  if (!valid) {
    throw new JwsError("The launch ticket signature is not valid", "invalid_signature");
  }

  try {
    return JSON.parse(base64UrlDecodeText(payloadSegment));
  } catch {
    throw new JwsError("The launch ticket payload is not valid JSON", "invalid_format");
  }
}

/**
 * Import a JWK as an ECDSA P-256 public key for verification.
 */
export async function importVerificationKey(jwk) {
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new JwsError(
      "The verification key is not an ECDSA P-256 public key",
      "invalid_key",
    );
  }
  return crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}
