import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRIDGE_EXTENSION_ID } from "@/lib/launch/bridge-config";

describe("the browser bridge deployment identity", () => {
  it("matches the id derived from the public key in the downloadable manifest", () => {
    const manifest = JSON.parse(
      readFileSync("apps/ccm-browser-bridge/manifest.json", "utf8"),
    ) as {
      key?: string;
      externally_connectable?: { matches?: string[] };
    };
    expect(manifest.key).toBeTruthy();

    const digest = createHash("sha256")
      .update(Buffer.from(manifest.key!, "base64"))
      .digest("hex")
      .slice(0, 32);
    const derivedId = digest.replace(/[0-9a-f]/g, (character) =>
      String.fromCharCode(97 + Number.parseInt(character, 16)),
    );

    expect(derivedId).toBe(BRIDGE_EXTENSION_ID);
    expect(manifest.externally_connectable?.matches).toContain(
      "https://ccm.eiden-group.com/*",
    );
  });
});
