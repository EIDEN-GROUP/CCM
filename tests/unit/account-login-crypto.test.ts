import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("saved account login encryption", () => {
  afterEach(() => {
    delete process.env.APP_ENCRYPTION_KEY;
  });

  it("encrypts passwords and binds them to one workspace/account", () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString("base64");
    const context = "ccm:account-login:v1:workspace-a:account-a";
    const envelope = encryptSecret("correct horse battery staple", context);

    expect(envelope).not.toContain("correct horse battery staple");
    expect(decryptSecret(envelope, context)).toBe("correct horse battery staple");
    expect(() => decryptSecret(envelope, "ccm:account-login:v1:workspace-b:account-a")).toThrow();
  });

  it("refuses to encrypt when the encryption key is missing or malformed", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => encryptSecret("password", "context")).toThrow(/APP_ENCRYPTION_KEY/);
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("password", "context")).toThrow(/32 bytes/);
  });
});
