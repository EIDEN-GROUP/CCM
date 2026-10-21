/**
 * Generate the launch-ticket signing key pair and print it ready to paste
 * into `.env`.
 *
 * The keys are ES256 (ECDSA P-256 / SHA-256), because WebCrypto support for
 * Ed25519 is still uneven across Chromium builds and the browser bridge
 * extension must verify tickets with the platform crypto API alone.
 *
 *   npm run keys:launch
 *
 * The printed values are single-line, with the newlines escaped as `\n`.
 * CCM's key loader rebuilds the PEM from its BEGIN/END markers, so a pasted
 * value works even if it gets mangled in transit.
 */
import { generateKeyPair, exportPKCS8, exportSPKI } from "jose";

const { privateKey, publicKey } = await generateKeyPair("ES256", {
  extractable: true,
});

const privatePem = await exportPKCS8(privateKey);
const publicPem = await exportSPKI(publicKey);

/** Collapse a PEM to one line with escaped newlines, for a .env file. */
function singleLine(pem: string): string {
  return pem.replace(/\r?\n/g, "\\n");
}

console.log("# CCM launch-ticket signing keys (ES256 / P-256)");
console.log("#");
console.log("# Keep the private key secret. The public key is embedded in the");
console.log("# browser bridge extension and published at /api/launch/public-key.");
console.log("");
console.log(`LAUNCH_SIGNING_KEY_ID=ccm-launch-1`);
console.log(`LAUNCH_SIGNING_PRIVATE_KEY="${singleLine(privatePem)}"`);
console.log(`LAUNCH_SIGNING_PUBLIC_KEY="${singleLine(publicPem)}"`);
console.log("");
console.log("# Expected lengths:");
console.log(
  `#   private PEM body: ${singleLine(privatePem).length} characters (a truncated key fails to import)`,
);
console.log(
  `#   public  PEM body: ${singleLine(publicPem).length} characters`,
);
console.log("");
console.log("# Paste the three lines above into .env, replacing the existing values.");
